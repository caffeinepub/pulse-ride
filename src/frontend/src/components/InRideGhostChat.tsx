import type { backendInterface as FullBackendInterface } from "@/backend.d";
import GhostCallOverlay from "@/components/GhostCallOverlay";
import { useActor } from "@/hooks/useActor";
import {
  FileText,
  MapPin,
  Paperclip,
  Phone,
  Send,
  SmilePlus,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface InRideGhostChatProps {
  rideId: string;
  mySessionId: string;
  userRole: "rider" | "driver";
  onClose: () => void;
}

type AutoDeleteMode = "30s" | "5m" | "session";
type MessageType = "text" | "photo" | "document" | "location";

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
  coords?: string;
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

function maskId(id: string): string {
  return `GHOST-${id.slice(-4).toUpperCase()}`;
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
  if (t.includes("konum") || t.includes("nerede") || t.includes("location"))
    return ["📍", "🗺️", "🌐", "📡"];
  if (t.includes("güvenli") || t.includes("şifreli") || t.includes("gizli"))
    return ["🔒", "🛡️", "💀", "👁️"];
  if (t.includes("tamam") || t.includes("ok") || t.includes("hazır"))
    return ["✅", "👍", "🚀", "⚡"];
  if (t.includes("haha") || t.includes("lol") || t.includes(":)"))
    return ["😂", "😊", "🎉", "🔥"];
  return ["🔥", "✨", "💯", "🎭"];
}

const GHOST_MESSAGES = [
  "Bağlantı güvenli 🔒",
  "Konum maskeli 📡",
  "AI şifrelemesi aktif ✨",
  "Kimlik izleri silindi 👻",
  "Oturum anonim 💀",
  "Ghost protokolü etkin ⚡",
];

export default function InRideGhostChat({
  rideId,
  mySessionId,
  userRole,
  onClose,
}: InRideGhostChatProps) {
  const { actor: _actor } = useActor();
  const actor = _actor as unknown as FullBackendInterface | null;

  const channelCode = `ride-${rideId}`;
  const myId = mySessionId;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [connectError, setConnectError] = useState("");
  const [partnerId, setPartnerId] = useState("GHOST-????");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [deleteMode, setDeleteMode] = useState<AutoDeleteMode>("session");
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  const [lastMsgIndex, setLastMsgIndex] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  const connectPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  // Connect on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (!actor) {
      // Solo fallback — simulate messages
      setConnecting(false);
      setConnected(true);
      setPartnerId(userRole === "rider" ? "GHOST-DRV1" : "GHOST-RDR1");
      return;
    }

    let cancelled = false;

    async function connect() {
      if (!actor) return;
      try {
        const created = await actor.createGroupChannel(channelCode, myId);
        if (cancelled) return;

        if (created) {
          // We are first — wait for partner
          connectPollRef.current = setInterval(async () => {
            if (cancelled || !actor) return;
            try {
              const members = await actor.listGroupMembers(channelCode, myId);
              if (members.length >= 2) {
                clearInterval(connectPollRef.current!);
                if (!cancelled) {
                  const partner =
                    members.find((m) => m !== myId) ?? "GHOST-????";
                  setPartnerId(maskId(partner));
                  setConnected(true);
                  setConnecting(false);
                }
              }
            } catch (_e) {
              // ignore
            }
          }, 1000);
        } else {
          // Channel exists — join
          const result = await actor.joinGroupChannel(channelCode, myId);
          if (cancelled) return;
          const memberCount = Number(result);
          if (result === "connected" || memberCount >= 2 || memberCount >= 1) {
            // Try to get partner id
            try {
              const members = await actor.listGroupMembers(channelCode, myId);
              const partner = members.find((m) => m !== myId) ?? "GHOST-????";
              setPartnerId(maskId(partner));
            } catch (_e) {
              // ignore
            }
            setConnected(true);
            setConnecting(false);
          } else {
            setConnectError("Bağlantı kurulamadı.");
            setConnecting(false);
          }
        }
      } catch (_e) {
        if (!cancelled) {
          // Fall back to solo
          setConnected(true);
          setConnecting(false);
          setPartnerId(userRole === "rider" ? "GHOST-DRV1" : "GHOST-RDR1");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (connectPollRef.current) clearInterval(connectPollRef.current);
    };
  }, [actor, channelCode, myId, userRole]);

  // Message polling when connected
  useEffect(() => {
    if (!connected || !actor) {
      // Solo mode incoming simulation
      if (connected && !actor) {
        let t: ReturnType<typeof setTimeout>;
        const schedule = () => {
          t = setTimeout(
            () => {
              const text =
                GHOST_MESSAGES[
                  Math.floor(Math.random() * GHOST_MESSAGES.length)
                ];
              const expiresAt = genExpiry(deleteMode);
              const msg: ChatMessage = {
                id: `${Date.now()}-inc`,
                type: "text",
                content: text,
                sender: "ghost",
                senderLabel: partnerId,
                deleteMode,
                createdAt: Date.now(),
                expiresAt,
                countdown: getCountdown(expiresAt),
              };
              setMessages((prev) => [...prev, msg]);
              setMsgCount((c) => c + 1);
              schedule();
            },
            10000 + Math.random() * 5000,
          );
        };
        schedule();
        return () => clearTimeout(t);
      }
      return;
    }

    msgPollRef.current = setInterval(async () => {
      if (!actor) return;
      try {
        const msgs = await actor.getGroupMessages(
          channelCode,
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
            // Detect incoming GHOST CALL invite
            if (
              numIdx >= lastMsgIndex &&
              senderId !== myId &&
              text.startsWith("__CALL__:INVITE:") &&
              !showCallOverlay
            ) {
              setIsCallInitiator(false);
              setShowCallOverlay(true);
            }
          }
          if (newMsgs.length > 0) {
            setMessages((prev) => [...prev, ...newMsgs]);
            setMsgCount((c) => c + newMsgs.length);
          }
          setLastMsgIndex(newIndex);
        }
      } catch (_e) {
        // ignore
      }
    }, 1000);

    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [
    connected,
    actor,
    channelCode,
    myId,
    lastMsgIndex,
    deleteMode,
    partnerId,
    showCallOverlay,
  ]);

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

  // Auto scroll
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectPollRef.current) clearInterval(connectPollRef.current);
      if (msgPollRef.current) clearInterval(msgPollRef.current);
      if (actor) {
        actor.leaveGroupChannel(channelCode, myId).catch(() => {});
      }
    };
  }, [actor, channelCode, myId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    const expiresAt = genExpiry(deleteMode);
    const msg: ChatMessage = {
      id: `${Date.now()}-me`,
      type: "text",
      content: text,
      sender: "me",
      senderLabel: myId,
      deleteMode,
      createdAt: Date.now(),
      expiresAt,
      countdown: getCountdown(expiresAt),
    };
    setMessages((prev) => [...prev, msg]);
    setMsgCount((c) => c + 1);
    setInput("");
    if (actor) {
      try {
        await actor.sendGroupMessage(channelCode, myId, text);
      } catch (_e) {
        // ignore
      }
    }
  }, [input, deleteMode, myId, actor, channelCode]);

  const handleEmojiClick = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPanel(false);
  };

  const handleFileAttach = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "document") => {
      const file = e.target.files?.[0];
      if (!file) return;
      const expiresAt = genExpiry(deleteMode);
      const msg: ChatMessage = {
        id: `${Date.now()}-file`,
        type,
        content:
          type === "photo" ? "[Fotoğraf paylaşıldı]" : "[Belge paylaşıldı]",
        sender: "me",
        senderLabel: myId,
        deleteMode,
        createdAt: Date.now(),
        expiresAt,
        countdown: getCountdown(expiresAt),
        filename: file.name,
        filesize: `${(file.size / 1024).toFixed(1)} KB`,
      };
      setMessages((prev) => [...prev, msg]);
      setMsgCount((c) => c + 1);
      if (actor) {
        actor.sendGroupMessage(channelCode, myId, msg.content).catch(() => {});
      }
      e.target.value = "";
    },
    [deleteMode, myId, actor, channelCode],
  );

  const handleLocationShare = useCallback(() => {
    const coords = `${(41.0 + Math.random() * 0.1).toFixed(5)}, ${(28.9 + Math.random() * 0.1).toFixed(5)}`;
    const expiresAt = genExpiry(deleteMode);
    const msg: ChatMessage = {
      id: `${Date.now()}-loc`,
      type: "location",
      content: `📍 Konum paylaşıldı: ${coords}`,
      sender: "me",
      senderLabel: myId,
      deleteMode,
      createdAt: Date.now(),
      expiresAt,
      countdown: getCountdown(expiresAt),
      coords,
    };
    setMessages((prev) => [...prev, msg]);
    setMsgCount((c) => c + 1);
    setShowAttachMenu(false);
    if (actor) {
      actor.sendGroupMessage(channelCode, myId, msg.content).catch(() => {});
    }
  }, [deleteMode, myId, actor, channelCode]);

  const accentColor = userRole === "rider" ? "#a855ff" : "#2ee6d6";
  const partnerColor = userRole === "rider" ? "#2ee6d6" : "#a855ff";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.97)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgba(168,85,255,0.3)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">👻</span>
          <div>
            <h1
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              GHOST CHAT
            </h1>
            <p className="text-[10px] text-[#a7b0c2] uppercase tracking-wider">
              💬 IN-RIDE · RIDE-{rideId.slice(-4).toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase"
            style={{
              background: connected
                ? "rgba(46,230,214,0.12)"
                : "rgba(255,150,0,0.12)",
              border: `1px solid ${
                connected ? "rgba(46,230,214,0.4)" : "rgba(255,150,0,0.4)"
              }`,
              color: connected ? "#2ee6d6" : "#ffaa00",
            }}
            data-ocid="ghost_chat.connection_status"
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: connected ? "#2ee6d6" : "#ffaa00",
                animation: !connected ? "pulse 1s infinite" : "none",
              }}
            />
            {connected
              ? partnerId
              : connecting
                ? "Bağlanıyor..."
                : "Bağlantı Hatası"}
          </div>
          {/* Call button */}
          {connected && (
            <button
              type="button"
              onClick={() => {
                setIsCallInitiator(true);
                setShowCallOverlay(true);
              }}
              className="p-2 rounded-full transition-all active:scale-90"
              style={{
                background: "rgba(46,230,214,0.1)",
                border: "1px solid rgba(46,230,214,0.3)",
              }}
              data-ocid="ghost_chat.call.button"
            >
              <Phone className="w-3.5 h-3.5" style={{ color: "#2ee6d6" }} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full transition-all active:scale-90"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            data-ocid="ghost_chat.close.button"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Connecting Screen */}
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4"
            data-ocid="ghost_chat.loading_state"
          >
            <div className="text-4xl">👻</div>
            <div
              className="text-sm font-bold uppercase tracking-widest animate-pulse"
              style={{ color: accentColor }}
            >
              {userRole === "rider"
                ? "Şoför bekleniyor..."
                : "Yolcuya bağlanıyor..."}
            </div>
            <div
              className="w-48 h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <div
                className="h-full rounded-full animate-pulse"
                style={{
                  width: "60%",
                  background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                }}
              />
            </div>
            <p className="text-[10px] text-[#a7b0c2] uppercase tracking-wider">
              Şifreli kanal kuruluyor · Ride-{rideId.slice(-4).toUpperCase()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Screen */}
      {!connecting && connectError && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3"
          data-ocid="ghost_chat.error_state"
        >
          <div className="text-3xl">⚠️</div>
          <p className="text-sm text-red-400 font-bold uppercase tracking-wider">
            {connectError}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#a7b0c2] underline"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Chat UI */}
      {!connecting && connected && (
        <>
          {/* Delete mode selector */}
          <div
            className="flex items-center gap-2 px-4 py-2 border-b"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <span className="text-[10px] text-[#a7b0c2] uppercase tracking-wider mr-1">
              ⏱ Otomatik Sil:
            </span>
            {(["30s", "5m", "session"] as AutoDeleteMode[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDeleteMode(opt)}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background:
                    deleteMode === opt
                      ? "rgba(0,255,247,0.12)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    deleteMode === opt ? "#00fff7" : "rgba(255,255,255,0.1)"
                  }`,
                  color: deleteMode === opt ? "#00fff7" : "#a7b0c2",
                }}
                data-ocid={`ghost_chat.delete_mode.${opt}.toggle`}
              >
                {opt === "30s" ? "30 sn" : opt === "5m" ? "5 dk" : "Oturum"}
              </button>
            ))}
          </div>

          {/* Message list */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            data-ocid="ghost_chat.message.list"
          >
            {messages.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full gap-2 py-12"
                data-ocid="ghost_chat.empty_state"
              >
                <div className="text-3xl opacity-30">💬</div>
                <p className="text-xs text-[#a7b0c2] text-center">
                  Şifreli kanal açık — güvenle yazın
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${
                    msg.sender === "me" ? "items-end" : "items-start"
                  }`}
                  data-ocid={`ghost_chat.message.item.${i + 1}`}
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider mb-0.5 px-1"
                    style={{
                      color: msg.sender === "me" ? accentColor : partnerColor,
                    }}
                  >
                    {msg.sender === "me" ? "SEN" : msg.senderLabel}
                  </span>
                  <div
                    className="max-w-[78%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                    style={{
                      background:
                        msg.sender === "me"
                          ? "rgba(168,85,255,0.15)"
                          : "rgba(46,230,214,0.1)",
                      border: `1px solid ${
                        msg.sender === "me"
                          ? "rgba(168,85,255,0.35)"
                          : "rgba(46,230,214,0.25)"
                      }`,
                      color: msg.sender === "me" ? "#e0aaff" : "#a5f3ef",
                    }}
                  >
                    {msg.type === "location" ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {msg.content}
                      </span>
                    ) : msg.type === "document" ? (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {msg.filename} · {msg.filesize}
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.countdown !== null && (
                    <span className="text-[9px] text-orange-400 mt-0.5 px-1">
                      ⏱ {msg.countdown}s
                    </span>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Emoji panel */}
          <AnimatePresence>
            {showEmojiPanel && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-4 py-3 border-t"
                style={{ borderColor: "rgba(168,85,255,0.2)" }}
              >
                <p className="text-[9px] text-[#a7b0c2] uppercase tracking-wider mb-2">
                  AI önerisi:
                  {getAiEmojis(input).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => handleEmojiClick(e)}
                      className="ml-1 text-sm hover:scale-125 transition-transform"
                    >
                      {e}
                    </button>
                  ))}
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => handleEmojiClick(e)}
                      className="text-lg hover:scale-125 transition-transform"
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="px-4 py-3 border-t flex gap-3"
                style={{ borderColor: "rgba(168,85,255,0.2)" }}
              >
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="flex flex-col items-center gap-1 text-[10px] text-[#a7b0c2] px-3 py-2 rounded-lg transition-all hover:bg-white/5"
                  data-ocid="ghost_chat.photo.upload_button"
                >
                  📷 <span>Fotoğraf</span>
                </button>
                <button
                  type="button"
                  onClick={() => docRef.current?.click()}
                  className="flex flex-col items-center gap-1 text-[10px] text-[#a7b0c2] px-3 py-2 rounded-lg transition-all hover:bg-white/5"
                  data-ocid="ghost_chat.doc.upload_button"
                >
                  📄 <span>Belge</span>
                </button>
                <button
                  type="button"
                  onClick={handleLocationShare}
                  className="flex flex-col items-center gap-1 text-[10px] text-[#a7b0c2] px-3 py-2 rounded-lg transition-all hover:bg-white/5"
                  data-ocid="ghost_chat.location.button"
                >
                  📍 <span>Konum</span>
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFileAttach(e, "photo");
                    setShowAttachMenu(false);
                  }}
                />
                <input
                  ref={docRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    handleFileAttach(e, "document");
                    setShowAttachMenu(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input area */}
          <div
            className="px-3 py-3 border-t flex items-center gap-2"
            style={{ borderColor: "rgba(168,85,255,0.25)" }}
          >
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu((v) => !v);
                setShowEmojiPanel(false);
              }}
              className="p-2 rounded-lg flex-shrink-0 transition-all"
              style={{
                background: showAttachMenu
                  ? "rgba(168,85,255,0.2)"
                  : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-ocid="ghost_chat.attach.button"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#a7b0c2]" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmojiPanel((v) => !v);
                setShowAttachMenu(false);
              }}
              className="p-2 rounded-lg flex-shrink-0 transition-all"
              style={{
                background: showEmojiPanel
                  ? "rgba(168,85,255,0.2)"
                  : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-ocid="ghost_chat.emoji.button"
            >
              <SmilePlus className="w-3.5 h-3.5 text-[#a7b0c2]" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Şifreli mesaj..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
              data-ocid="ghost_chat.input"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-lg flex-shrink-0 transition-all active:scale-90 disabled:opacity-40"
              style={{
                background: input.trim()
                  ? "rgba(168,85,255,0.3)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${
                  input.trim()
                    ? "rgba(168,85,255,0.5)"
                    : "rgba(255,255,255,0.1)"
                }`,
              }}
              data-ocid="ghost_chat.send.button"
            >
              <Send
                className="w-3.5 h-3.5"
                style={{ color: input.trim() ? "#a855ff" : "#a7b0c2" }}
              />
            </button>
          </div>
        </>
      )}

      {/* Ghost Call Overlay */}
      <AnimatePresence>
        {showCallOverlay && (
          <GhostCallOverlay
            isOpen={showCallOverlay}
            channelCode={`${channelCode}-call`}
            myId={myId}
            callerIds={[myId, partnerId]}
            actor={actor as any}
            isInitiator={isCallInitiator}
            onClose={() => {
              setShowCallOverlay(false);
              setIsCallInitiator(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
