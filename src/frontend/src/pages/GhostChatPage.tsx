import type { backendInterface as FullBackendInterface } from "@/backend.d";
import GhostCallOverlay from "@/components/GhostCallOverlay";
import { useActor } from "@/hooks/useActor";
import {
  AlertTriangle,
  FileText,
  Lock,
  MapPin,
  Paperclip,
  Phone,
  Send,
  SmilePlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface GhostChatPageProps {
  onBack: () => void;
}

type AutoDeleteMode = "30s" | "5m" | "session";
type MessageType = "text" | "photo" | "document" | "location";
type ConnectionMode = "setup" | "solo" | "connecting" | "p2p";

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  sender: "me" | "ghost";
  senderLabel: string;
  deleteMode: AutoDeleteMode;
  createdAt: number;
  expiresAt: number | null;
  countdown: number | null;
  filename?: string;
  filesize?: string;
  thumbnail?: string;
  coords?: string;
  isExpired?: boolean;
}

function genGhostId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "GHOST-";
  for (let i = 0; i < 4; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function genExpiry(mode: AutoDeleteMode): number | null {
  if (mode === "session") return null;
  if (mode === "30s") return Date.now() + 30000;
  if (mode === "5m") return Date.now() + 300000;
  return null;
}

function getCountdown(expiresAt: number | null): number | null {
  if (expiresAt === null) return null;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

// Simple deterministic hash to display room fingerprint
function roomFingerprint(password: string): string {
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = (Math.imul(31, h) + password.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(16).toUpperCase().padStart(8, "0");
  return `GCHAT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

const COMMON_EMOJIS = [
  "😊",
  "😂",
  "❤️",
  "🔥",
  "✨",
  "🙏",
  "💯",
  "🤔",
  "😎",
  "🎉",
  "🔒",
  "💀",
  "⚡",
  "🌐",
  "📍",
  "🗺️",
  "🚀",
  "👻",
  "🌙",
  "💬",
  "😮",
  "🤝",
  "💪",
  "🕵️",
  "🔮",
  "🛡️",
  "📡",
  "👁️",
  "🎭",
  "💻",
];

function getAiEmojis(text: string): string[] {
  const t = text.toLowerCase();
  if (
    t.includes("konum") ||
    t.includes("nerede") ||
    t.includes("location") ||
    t.includes("adres")
  )
    return ["📍", "🗺️", "🌐", "📡"];
  if (
    t.includes("tehlike") ||
    t.includes("gizli") ||
    t.includes("şifreli") ||
    t.includes("güvenli")
  )
    return ["🔒", "🛡️", "💀", "👁️"];
  if (
    t.includes("haha") ||
    t.includes("lol") ||
    t.includes("güldü") ||
    t.includes(":)")
  )
    return ["😂", "😊", "🎉", "🔥"];
  if (
    t.includes("gel") ||
    t.includes("hazır") ||
    t.includes("tamam") ||
    t.includes("ok")
  )
    return ["✅", "👍", "🚀", "⚡"];
  return ["🔥", "✨", "💯", "🎭"];
}

const GHOST_MESSAGES = [
  "Bağlantı güvenli 🔒",
  "Konum maskeli 📡",
  "AI şifrelemesi aktif ✨",
  "Kimlik izleri silindi 👻",
  "Oturum anonim 💀",
  "Ghost protokolü etkin ⚡",
  "Veri sıfırlanıyor... 🔮",
  "Anon kanal aktif 🛡️",
];

export default function GhostChatPage({ onBack }: GhostChatPageProps) {
  const { actor: _actor } = useActor();
  const actor = _actor as unknown as FullBackendInterface | null;

  const [myId] = useState(genGhostId);
  const [partnerId, setPartnerId] = useState(genGhostId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [deleteMode, setDeleteMode] = useState<AutoDeleteMode>("session");
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  // P2P password mode
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("setup");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [connectingStatus, setConnectingStatus] = useState(
    "Şifre doğrulanıyor...",
  );
  const [lastMsgIndex, setLastMsgIndex] = useState(0);
  // p2pPollRef: only for message polling in p2p mode
  const p2pPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // connectPollRef: only for connection establishment polling
  const connectPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

  // Session timer
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Message countdown & expiry
  useEffect(() => {
    const iv = setInterval(() => {
      setMessages((prev) =>
        prev
          .map((m) => {
            if (m.expiresAt === null) return m;
            const c = getCountdown(m.expiresAt);
            return { ...m, countdown: c };
          })
          .filter((m) => {
            if (m.expiresAt === null) return true;
            return (m.countdown ?? 1) > 0;
          }),
      );
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Simulate incoming messages (solo mode only)
  useEffect(() => {
    if (connectionMode !== "solo") return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 8000 + Math.random() * 4000;
      t = setTimeout(() => {
        const text =
          GHOST_MESSAGES[Math.floor(Math.random() * GHOST_MESSAGES.length)];
        const mode: AutoDeleteMode = (
          ["30s", "5m", "session"] as AutoDeleteMode[]
        )[Math.floor(Math.random() * 3)];
        const expiresAt = genExpiry(mode);
        const msg: ChatMessage = {
          id: `${Date.now()}-inc`,
          type: "text",
          content: text,
          sender: "ghost",
          senderLabel: partnerId,
          deleteMode: mode,
          createdAt: Date.now(),
          expiresAt,
          countdown: getCountdown(expiresAt),
        };
        setMessages((prev) => [...prev, msg]);
        setMsgCount((c) => c + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(t);
  }, [partnerId, connectionMode]);

  // P2P message polling (only active in p2p mode)
  useEffect(() => {
    if (connectionMode !== "p2p" || !actor || !roomCode) return;
    p2pPollRef.current = setInterval(async () => {
      try {
        const msgs = await actor.getGroupMessages(
          roomCode,
          myId,
          BigInt(lastMsgIndex),
        );
        if (msgs.length > 0) {
          let newIndex = lastMsgIndex;
          const newMsgs: ChatMessage[] = [];
          for (const [senderId, text, idx] of msgs) {
            const numIdx = Number(idx);
            if (
              numIdx >= lastMsgIndex &&
              senderId !== myId &&
              !text.startsWith("__CALL__:")
            ) {
              const expiresAt = genExpiry(deleteMode);
              newMsgs.push({
                id: `p2p-${numIdx}`,
                type: "text",
                content: text,
                sender: "ghost",
                senderLabel: partnerId,
                deleteMode,
                createdAt: Date.now(),
                expiresAt,
                countdown: getCountdown(expiresAt),
              });
            }
            if (numIdx + 1 > newIndex) newIndex = numIdx + 1;
          }
          if (newMsgs.length > 0) {
            setMessages((prev) => [...prev, ...newMsgs]);
            setMsgCount((c) => c + newMsgs.length);
          }
          setLastMsgIndex(newIndex);
        }
      } catch (_e) {
        // ignore poll errors
      }
    }, 1000);
    return () => {
      if (p2pPollRef.current) clearInterval(p2pPollRef.current);
    };
  }, [
    connectionMode,
    actor,
    roomCode,
    myId,
    partnerId,
    lastMsgIndex,
    deleteMode,
  ]);

  // Auto scroll
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger on msgCount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (p2pPollRef.current) clearInterval(p2pPollRef.current);
      if (connectPollRef.current) clearInterval(connectPollRef.current);
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
  }, []);

  const handleConnectWithPassword = async () => {
    const pw = passwordInput.trim();
    if (pw.length < 6) {
      setPasswordError("Şifre en az 6 karakter olmalı");
      return;
    }
    setPasswordError("");
    const code = `chatroom-${pw}`;
    setRoomCode(code);
    setConnectionMode("connecting");
    setConnectingStatus("Oda oluşturuluyor...");

    if (!actor) {
      setConnectionMode("solo");
      return;
    }

    try {
      // Try to create channel — returns true if successfully created (we are first)
      const created = await actor.createGroupChannel(code, myId);
      if (created) {
        setIsCreator(true);
        setConnectingStatus("Oda oluşturuldu. Partner bekleniyor...");
        let waited = 0;
        const poll = setInterval(async () => {
          waited += 1;
          if (waited > 120) {
            clearInterval(poll);
            try {
              await actor.leaveGroupChannel(code, myId);
            } catch (_e) {
              /* ignore */
            }
            setPasswordError("Zaman aşımı — şifreyi tekrar deneyin");
            setConnectionMode("setup");
            return;
          }
          try {
            const members = await actor.listGroupMembers(code, myId);
            if (members.length >= 2) {
              clearInterval(poll);
              setConnectionMode("p2p");
              setPartnerId(genGhostId());
            }
          } catch (_e) {
            /* ignore */
          }
        }, 1000);
        connectPollRef.current = poll;
      } else {
        // Channel exists — try to join as second user
        setConnectingStatus("Odaya katılınıyor...");
        const result = await actor.joinGroupChannel(code, myId);
        const memberCount = Number.parseInt(result);
        if (
          result === "connected" ||
          (!Number.isNaN(memberCount) && memberCount >= 2)
        ) {
          setConnectionMode("p2p");
          setPartnerId(genGhostId());
        } else if (
          result === "waiting" ||
          (!Number.isNaN(memberCount) && memberCount === 1)
        ) {
          // Still waiting — poll for members
          setConnectingStatus("Bağlantı kuruluyor...");
          let waited = 0;
          const poll = setInterval(async () => {
            waited += 1;
            if (waited > 60) {
              clearInterval(poll);
              try {
                await actor.leaveGroupChannel(code, myId);
              } catch (_e) {
                /* ignore */
              }
              setPasswordError("Zaman aşımı — şifreyi tekrar deneyin");
              setConnectionMode("setup");
              return;
            }
            try {
              const members = await actor.listGroupMembers(code, myId);
              if (members.length >= 2) {
                clearInterval(poll);
                setConnectionMode("p2p");
                setPartnerId(genGhostId());
              }
            } catch (_e) {
              /* ignore */
            }
          }, 1000);
          connectPollRef.current = poll;
        } else if (result === "full") {
          setPasswordError("Bu oda dolu — farklı bir şifre deneyin");
          setConnectionMode("setup");
        } else {
          // "not_found" or unknown — become creator
          setConnectingStatus("Yeni oda oluşturuluyor...");
          try {
            const freshCreated = await actor.createGroupChannel(code, myId);
            if (freshCreated) {
              setIsCreator(true);
              setConnectingStatus("Oda oluşturuldu. Partner bekleniyor...");
              let waited = 0;
              const poll = setInterval(async () => {
                waited += 1;
                if (waited > 120) {
                  clearInterval(poll);
                  try {
                    await actor.leaveGroupChannel(code, myId);
                  } catch (_e) {
                    /* ignore */
                  }
                  setPasswordError("Zaman aşımı — şifreyi tekrar deneyin");
                  setConnectionMode("setup");
                  return;
                }
                try {
                  const members = await actor.listGroupMembers(code, myId);
                  if (members.length >= 2) {
                    clearInterval(poll);
                    setConnectionMode("p2p");
                    setPartnerId(genGhostId());
                  }
                } catch (_e) {
                  /* ignore */
                }
              }, 1000);
              connectPollRef.current = poll;
            } else {
              // Someone else just created it, join again
              const r2 = await actor.joinGroupChannel(code, myId);
              const r2Count = Number.parseInt(r2);
              if (
                r2 === "connected" ||
                (!Number.isNaN(r2Count) && r2Count >= 2)
              ) {
                setConnectionMode("p2p");
                setPartnerId(genGhostId());
              } else {
                setPasswordError("Bağlantı kurulamadı — tekrar deneyin");
                setConnectionMode("setup");
              }
            }
          } catch (_e) {
            setPasswordError("Bağlantı hatası — tekrar deneyin");
            setConnectionMode("setup");
          }
        }
      }
    } catch (_e) {
      setPasswordError("Bağlantı hatası — tekrar deneyin");
      setConnectionMode("setup");
    }
  };

  const sendMessage = useCallback(
    async (
      overrideContent?: string,
      overrideType?: MessageType,
      extra?: Partial<ChatMessage>,
    ) => {
      const content = overrideContent ?? input.trim();
      if (!content && !extra) return;
      const expiresAt = genExpiry(deleteMode);
      const msg: ChatMessage = {
        id: `${Date.now()}-out`,
        type: overrideType ?? "text",
        content,
        sender: "me",
        senderLabel: myId,
        deleteMode,
        createdAt: Date.now(),
        expiresAt,
        countdown: getCountdown(expiresAt),
        ...extra,
      };
      setMessages((prev) => [...prev, msg]);
      setMsgCount((c) => c + 1);
      setInput("");
      setShowEmojiPanel(false);
      setShowAttachMenu(false);

      // Send to backend if in P2P mode
      if (
        connectionMode === "p2p" &&
        actor &&
        roomCode &&
        overrideType !== "photo" &&
        overrideType !== "document" &&
        overrideType !== "location"
      ) {
        try {
          await actor.sendGroupMessage(roomCode, myId, content);
        } catch (_e) {
          /* ignore */
        }
      }
    },
    [input, deleteMode, myId, connectionMode, actor, roomCode],
  );

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    sendMessage(file.name, "photo", { thumbnail: url, filename: file.name });
    e.target.value = "";
  };

  const handleDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kb = (file.size / 1024).toFixed(1);
    const mb =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${kb} KB`;
    sendMessage(file.name, "document", { filename: file.name, filesize: mb });
    e.target.value = "";
  };

  const handleLocation = () => {
    const lat = (37.0 + Math.random() * 5).toFixed(4);
    const lon = (28.0 + Math.random() * 10).toFixed(4);
    const coords = `${lat}°N ${lon}°E`;
    sendMessage(coords, "location", { coords });
    setShowAttachMenu(false);
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleEndSession = async () => {
    if (connectionMode === "p2p" && actor && roomCode) {
      try {
        await actor.leaveGroupChannel(roomCode, myId);
      } catch (_e) {
        /* ignore */
      }
    }
    setEnded(true);
    setTimeout(() => onBack(), 2500);
  };

  const aiEmojis = getAiEmojis(input);

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (connectionMode === "setup") {
    const fingerprint =
      passwordInput.trim().length >= 6
        ? roomFingerprint(passwordInput.trim())
        : null;
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-6"
        style={{ background: "linear-gradient(to bottom, #060812, #0a0f1e)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-4xl">👻</div>
            <h1
              className="text-lg font-bold uppercase tracking-widest"
              style={{ color: "#00fff7", fontFamily: "monospace" }}
            >
              GHOST CHAT
            </h1>
            <p className="text-xs text-white/40">
              Şifreli oda ile partnere bağlan veya tek başına devam et
            </p>
          </div>

          {/* Password Box */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "rgba(0,255,247,0.04)",
              border: "1px solid rgba(0,255,247,0.2)",
            }}
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" style={{ color: "#00fff7" }} />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "#00fff7" }}
              >
                Şifreli Oda Bağlantısı
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleConnectWithPassword()
                }
                placeholder="Ortak şifrenizi girin (min. 6 karakter)"
                className="w-full bg-transparent text-sm text-white placeholder-white/25 outline-none px-3 py-2.5 rounded-xl"
                style={{ border: "1px solid rgba(0,255,247,0.25)" }}
              />
              {fingerprint && (
                <div
                  className="text-center text-[10px] font-mono tracking-widest py-1 rounded-lg"
                  style={{
                    color: "#a855f7",
                    background: "rgba(168,85,247,0.08)",
                    border: "1px solid rgba(168,85,247,0.2)",
                  }}
                >
                  🔑 Oda Kimliği: {fingerprint}
                </div>
              )}
              {passwordError && (
                <p className="text-[11px] text-red-400">{passwordError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleConnectWithPassword}
              disabled={passwordInput.trim().length < 6}
              className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,255,247,0.25), rgba(0,255,247,0.1))",
                border: "1px solid rgba(0,255,247,0.5)",
                color: "#00fff7",
                boxShadow:
                  passwordInput.trim().length >= 6
                    ? "0 0 24px rgba(0,255,247,0.2)"
                    : "none",
              }}
            >
              🔗 Şifre ile Bağlan
            </button>

            <div className="text-[10px] text-white/30 space-y-0.5">
              <p>• İki kullanıcı aynı şifreyi girerse otomatik bağlanır</p>
              <p>• Oda maksimum 2 kişiyle sınırlı — izinsiz giriş engellenir</p>
              <p>• Oturum kapanınca tüm mesajlar silinir</p>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <span className="text-[10px] text-white/25 uppercase tracking-wider">
              veya
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Solo mode */}
          <button
            type="button"
            onClick={() => setConnectionMode("solo")}
            className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#a7b0c2",
            }}
          >
            👤 Tek Başına Devam Et
          </button>

          {/* Back */}
          <button
            type="button"
            onClick={onBack}
            className="w-full text-xs text-white/20 hover:text-white/40 transition-colors"
          >
            ← Geri Dön
          </button>
        </motion.div>
      </div>
    );
  }

  // ── CONNECTING SCREEN ─────────────────────────────────────────────────────
  if (connectionMode === "connecting") {
    const fingerprint = roomFingerprint(passwordInput.trim());
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-6"
        style={{ background: "linear-gradient(to bottom, #060812, #0a0f1e)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center space-y-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="text-5xl mx-auto"
          >
            🔮
          </motion.div>
          <div className="space-y-2">
            <p
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: "#00fff7", fontFamily: "monospace" }}
            >
              {connectingStatus}
            </p>
            <div
              className="text-xs font-mono px-4 py-2 rounded-full mx-auto inline-block"
              style={{
                color: "#a855f7",
                background: "rgba(168,85,247,0.1)",
                border: "1px solid rgba(168,85,247,0.3)",
              }}
            >
              {fingerprint}
            </div>
            <p className="text-[11px] text-white/30 mt-2">
              Partnerinize bu oda kimliğini göstererek aynı şifreyi
              doğrulayabilirsiniz
            </p>
          </div>

          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: "#00fff7" }}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 1.2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (connectPollRef.current) clearInterval(connectPollRef.current);
              if (p2pPollRef.current) clearInterval(p2pPollRef.current);
              setConnectionMode("setup");
            }}
            className="text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            İptal
          </button>
        </motion.div>
      </div>
    );
  }

  // ── MAIN CHAT VIEW (solo or p2p) ──────────────────────────────────────────
  const isP2P = connectionMode === "p2p";

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "linear-gradient(to bottom, #060812, #0a0f1e)" }}
    >
      {/* Hidden file inputs */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFile}
      />
      <input
        ref={docRef}
        type="file"
        className="hidden"
        onChange={handleDocFile}
      />

      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          borderColor: "rgba(0,255,247,0.15)",
          background: "rgba(6,8,18,0.95)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              border: "1px solid rgba(0,255,247,0.3)",
              color: "#00fff7",
            }}
            data-ocid="ghostchat.close_button"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <div
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "#00fff7", fontFamily: "monospace" }}
            >
              👻 {myId}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: isP2P ? "#00ff88" : "#888" }}
              />
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: isP2P ? "#00ff88" : "#666" }}
              >
                {isP2P ? (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> P2P Şifreli Kanal
                  </span>
                ) : (
                  "Ghost Kanal • Solo"
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isP2P && (
            <div
              className="text-[10px] px-2 py-1 rounded-full font-mono"
              style={{
                color: "#a855f7",
                border: "1px solid rgba(168,85,247,0.3)",
                background: "rgba(168,85,247,0.08)",
              }}
            >
              🔑{" "}
              {roomFingerprint(passwordInput.trim())
                .split("-")
                .slice(1)
                .join("-")}
            </div>
          )}
          <div
            className="text-xs px-3 py-1 rounded-full"
            style={{
              fontFamily: "monospace",
              color: "#a855f7",
              border: "1px solid rgba(168,85,247,0.3)",
              background: "rgba(168,85,247,0.08)",
            }}
          >
            ⏱ {formatTimer(elapsed)}
          </div>
          <button
            type="button"
            onClick={() => setShowCallOverlay(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              background: "rgba(0,255,136,0.08)",
              border: "1px solid rgba(0,255,136,0.3)",
              color: "#00ff88",
            }}
            data-ocid="ghostchat.call_button"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* P2P connected banner */}
      {isP2P && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider"
          style={{
            background: "rgba(0,255,136,0.08)",
            borderBottom: "1px solid rgba(0,255,136,0.2)",
            color: "#00ff88",
          }}
        >
          🔒 Şifreli P2P Kanal Aktif — Mesajlar uçtan uca şifreli
        </motion.div>
      )}

      {/* Delete mode selector */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
        style={{
          borderColor: "rgba(0,255,247,0.08)",
          background: "rgba(6,8,18,0.9)",
        }}
      >
        <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">
          Otomatik Sil:
        </span>
        {(["30s", "5m", "session"] as AutoDeleteMode[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setDeleteMode(opt)}
            className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider transition-all"
            style={{
              background:
                deleteMode === opt
                  ? "rgba(0,255,247,0.18)"
                  : "rgba(255,255,255,0.04)",
              border:
                deleteMode === opt
                  ? "1px solid rgba(0,255,247,0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
              color: deleteMode === opt ? "#00fff7" : "#a7b0c2",
            }}
            data-ocid={`ghostchat.${opt}_delete.toggle`}
          >
            {opt === "30s" ? "30 Sn" : opt === "5m" ? "5 Dk" : "Oturum"}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex flex-col ${
                msg.sender === "me" ? "items-end" : "items-start"
              }`}
            >
              <div
                className="max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1"
                style={{
                  background:
                    msg.sender === "me"
                      ? "linear-gradient(135deg, rgba(0,255,247,0.18), rgba(0,255,247,0.08))"
                      : "rgba(255,255,255,0.06)",
                  border:
                    msg.sender === "me"
                      ? "1px solid rgba(0,255,247,0.3)"
                      : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {msg.type === "text" && (
                  <p className="text-sm text-white leading-relaxed">
                    {msg.content}
                  </p>
                )}
                {msg.type === "photo" && (
                  <div className="space-y-1">
                    {msg.thumbnail && (
                      <img
                        src={msg.thumbnail}
                        alt=""
                        className="rounded-xl max-w-full max-h-48 object-cover"
                      />
                    )}
                    <p className="text-[11px] text-white/50">{msg.filename}</p>
                  </div>
                )}
                {msg.type === "document" && (
                  <div className="flex items-center gap-2">
                    <FileText
                      className="w-5 h-5 shrink-0"
                      style={{ color: "#a855f7" }}
                    />
                    <div>
                      <p className="text-sm text-white">{msg.filename}</p>
                      {msg.filesize && (
                        <p className="text-[11px] text-white/40">
                          {msg.filesize}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {msg.type === "location" && (
                  <div className="flex items-center gap-2">
                    <MapPin
                      className="w-4 h-4 shrink-0"
                      style={{ color: "#00ff88" }}
                    />
                    <p className="text-sm text-white font-mono">
                      {msg.content}
                    </p>
                  </div>
                )}
                {msg.countdown !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className="text-[10px]"
                      style={{
                        color: msg.countdown < 10 ? "#ff3250" : "#a7b0c2",
                      }}
                    >
                      ⏳ {msg.countdown}s
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-white/20 mt-1 mx-1">
                {msg.senderLabel}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* AI Emoji suggestions */}
      {input.trim().length > 2 && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 border-t shrink-0"
          style={{
            borderColor: "rgba(0,255,247,0.08)",
            background: "rgba(6,8,18,0.9)",
          }}
        >
          <span className="text-[10px] text-white/20 uppercase tracking-wider">
            AI Öneri:
          </span>
          {aiEmojis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setInput((prev) => prev + e)}
              className="text-lg hover:scale-125 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Emoji panel */}
      <AnimatePresence>
        {showEmojiPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t px-4 py-3 shrink-0"
            style={{
              borderColor: "rgba(0,255,247,0.12)",
              background: "rgba(6,8,18,0.97)",
            }}
          >
            <div className="flex flex-wrap gap-2">
              {COMMON_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setInput((prev) => prev + e)}
                  className="text-xl hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attach menu */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t px-4 py-3 shrink-0"
            style={{
              borderColor: "rgba(168,85,247,0.2)",
              background: "rgba(6,8,18,0.97)",
            }}
          >
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                style={{
                  background: "rgba(0,255,247,0.07)",
                  border: "1px solid rgba(0,255,247,0.2)",
                }}
              >
                <span className="text-xl">📸</span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "#00fff7" }}
                >
                  Fotoğraf
                </span>
              </button>
              <button
                type="button"
                onClick={() => docRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                style={{
                  background: "rgba(168,85,247,0.07)",
                  border: "1px solid rgba(168,85,247,0.2)",
                }}
              >
                <FileText className="w-5 h-5" style={{ color: "#a855f7" }} />
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "#a855f7" }}
                >
                  Belge
                </span>
              </button>
              <button
                type="button"
                onClick={handleLocation}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                style={{
                  background: "rgba(0,255,136,0.07)",
                  border: "1px solid rgba(0,255,136,0.2)",
                }}
              >
                <MapPin className="w-5 h-5" style={{ color: "#00ff88" }} />
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "#00ff88" }}
                >
                  Konum
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div
        className="flex items-center gap-2 px-3 py-3 border-t"
        style={{
          borderColor: "rgba(0,255,247,0.12)",
          background: "rgba(6,8,18,0.98)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowAttachMenu((p) => !p);
            setShowEmojiPanel(false);
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
          style={{
            background: showAttachMenu
              ? "rgba(168,85,247,0.2)"
              : "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.35)",
            color: "#a855f7",
          }}
          data-ocid="ghostchat.upload_button"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowEmojiPanel((p) => !p);
            setShowAttachMenu(false);
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
          style={{
            background: showEmojiPanel
              ? "rgba(0,255,247,0.18)"
              : "rgba(0,255,247,0.06)",
            border: "1px solid rgba(0,255,247,0.3)",
            color: "#00fff7",
          }}
          data-ocid="ghostchat.emoji.button"
        >
          <SmilePlus className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={
            isP2P ? "P2P şifreli mesaj..." : "Mesajını yaz... (şifreli)"
          }
          className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none px-3 py-2 rounded-xl"
          style={{ border: "1px solid rgba(0,255,247,0.15)" }}
          data-ocid="ghostchat.input"
        />

        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,255,247,0.3), rgba(0,255,247,0.1))",
            border: "1px solid rgba(0,255,247,0.5)",
            color: "#00fff7",
            boxShadow: input.trim() ? "0 0 16px rgba(0,255,247,0.25)" : "none",
          }}
          data-ocid="ghostchat.submit_button"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* End session confirm modal */}
      <AnimatePresence>
        {showEndConfirm && !ended && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)" }}
            data-ocid="ghostchat.dialog"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl p-6 max-w-sm w-full text-center space-y-4"
              style={{
                background: "rgba(10,15,30,0.98)",
                border: "1px solid rgba(255,50,80,0.4)",
                boxShadow: "0 0 40px rgba(255,50,80,0.15)",
              }}
            >
              <AlertTriangle
                className="w-10 h-10 mx-auto"
                style={{ color: "#ff3250" }}
              />
              <h3 className="text-base font-bold uppercase tracking-widest text-white">
                Oturumu Sonlandır?
              </h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Tüm mesajlar, dosyalar ve konum verileri kalıcı olarak
                silinecek.
                {isP2P && " P2P kanal da kapatılacak."}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#a7b0c2",
                  }}
                  data-ocid="ghostchat.cancel_button"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: "rgba(255,50,80,0.2)",
                    border: "1px solid rgba(255,50,80,0.5)",
                    color: "#ff3250",
                    boxShadow: "0 0 16px rgba(255,50,80,0.2)",
                  }}
                  data-ocid="ghostchat.confirm_button"
                >
                  Sonlandır
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ended overlay */}
      <AnimatePresence>
        {ended && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(6,8,18,0.97)" }}
          >
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="text-6xl"
              >
                ✓
              </motion.div>
              <p
                className="text-base font-bold uppercase tracking-widest"
                style={{ color: "#00ff88" }}
              >
                Oturum Sonlandırıldı
              </p>
              <p className="text-xs text-white/40">
                Tüm mesajlar ve veriler kalıcı olarak silindi ✓
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost Call Overlay */}
      {showCallOverlay && (
        <GhostCallOverlay
          isOpen={showCallOverlay}
          onClose={() => setShowCallOverlay(false)}
          callerIds={[myId, partnerId]}
          actor={actor}
          channelCode={roomCode}
          myId={myId}
          isInitiator={isCreator}
        />
      )}
    </div>
  );
}
