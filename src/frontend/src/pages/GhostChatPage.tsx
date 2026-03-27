import {
  AlertTriangle,
  FileText,
  MapPin,
  Paperclip,
  Send,
  SmilePlus,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface GhostChatPageProps {
  onBack: () => void;
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
  const [myId] = useState(genGhostId);
  const [partnerId] = useState(genGhostId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [deleteMode, setDeleteMode] = useState<AutoDeleteMode>("session");
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
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

  // Simulate incoming messages
  useEffect(() => {
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
  }, [partnerId]);

  const [msgCount, setMsgCount] = useState(0);

  // Auto scroll when msgCount changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger on msgCount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgCount]);

  const sendMessage = useCallback(
    (
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
    },
    [input, deleteMode, myId],
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
    // Anonymized / randomized coords
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

  const handleEndSession = () => {
    setEnded(true);
    setTimeout(() => onBack(), 2500);
  };

  const aiEmojis = getAiEmojis(input);

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
                style={{ background: "#00ff88" }}
              />
              <span className="text-[10px] text-green-400 uppercase tracking-wider">
                Ghost Kanal • E2E Şifreli
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            onClick={() => setShowEndConfirm(true)}
            className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest transition-all hover:opacity-90"
            style={{
              background: "rgba(255,50,80,0.15)",
              border: "1px solid rgba(255,50,80,0.4)",
              color: "#ff3250",
            }}
            data-ocid="ghostchat.end_session.button"
          >
            SONLANDIR
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        ref={scrollRef}
      >
        {/* Partner info banner */}
        <div className="flex justify-center mb-2">
          <div
            className="text-[10px] px-3 py-1.5 rounded-full"
            style={{
              fontFamily: "monospace",
              color: "#a855f7",
              border: "1px solid rgba(168,85,247,0.25)",
              background: "rgba(168,85,247,0.08)",
            }}
          >
            🔮 {partnerId} bağlandı • Tüm iletiler uçtan uca şifreli
          </div>
        </div>

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{
                opacity: msg.countdown !== null && msg.countdown <= 5 ? 0.4 : 1,
                y: 0,
                scale: 1,
              }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[78%] rounded-2xl px-3 py-2.5 space-y-1.5"
                style={{
                  background:
                    msg.sender === "me"
                      ? "linear-gradient(135deg, rgba(0,255,247,0.12), rgba(0,255,247,0.06))"
                      : "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.07))",
                  border:
                    msg.sender === "me"
                      ? "1px solid rgba(0,255,247,0.25)"
                      : "1px solid rgba(168,85,247,0.3)",
                  boxShadow:
                    msg.sender === "me"
                      ? "0 0 12px rgba(0,255,247,0.08)"
                      : "0 0 12px rgba(168,85,247,0.08)",
                }}
              >
                {/* Sender label */}
                <div
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{
                    color: msg.sender === "me" ? "#00fff7" : "#a855f7",
                    fontFamily: "monospace",
                  }}
                >
                  {msg.senderLabel}
                </div>

                {/* Content by type */}
                {msg.type === "text" && (
                  <p className="text-sm text-white leading-relaxed">
                    {msg.content}
                  </p>
                )}

                {msg.type === "photo" && (
                  <div className="space-y-1.5">
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={msg.thumbnail}
                        alt={msg.filename}
                        className="w-48 h-32 object-cover block"
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: "rgba(0,0,0,0.45)",
                          color: "#00ff88",
                        }}
                      >
                        🔒 ŞİFRELİ
                      </div>
                    </div>
                    <p className="text-[10px] text-white/60 truncate">
                      {msg.filename}
                    </p>
                  </div>
                )}

                {msg.type === "document" && (
                  <div
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                    style={{
                      background: "rgba(0,255,247,0.06)",
                      border: "1px solid rgba(0,255,247,0.15)",
                    }}
                  >
                    <FileText
                      className="w-5 h-5 shrink-0"
                      style={{ color: "#00fff7" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">
                        {msg.filename}
                      </p>
                      <p className="text-[9px] text-white/50">{msg.filesize}</p>
                    </div>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: "rgba(0,255,136,0.12)",
                        color: "#00ff88",
                        border: "1px solid rgba(0,255,136,0.3)",
                      }}
                    >
                      🔒 ŞİFRELİ
                    </span>
                  </div>
                )}

                {msg.type === "location" && (
                  <div
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                    style={{
                      background: "rgba(168,85,247,0.08)",
                      border: "1px solid rgba(168,85,247,0.25)",
                    }}
                  >
                    <MapPin
                      className="w-5 h-5 shrink-0"
                      style={{ color: "#a855f7" }}
                    />
                    <div className="flex-1">
                      <p
                        className="text-xs font-bold"
                        style={{ color: "#a855f7", fontFamily: "monospace" }}
                      >
                        {msg.coords}
                      </p>
                      <p className="text-[9px] text-white/40">Anonim konum</p>
                    </div>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: "rgba(0,255,136,0.12)",
                        color: "#00ff88",
                        border: "1px solid rgba(0,255,136,0.3)",
                      }}
                    >
                      🔒 ANONİM
                    </span>
                  </div>
                )}

                {/* Countdown badge */}
                {msg.countdown !== null && (
                  <div
                    className="flex items-center gap-1 text-[9px] font-bold"
                    style={{
                      color: msg.countdown <= 10 ? "#ff3250" : "#f59e0b",
                    }}
                  >
                    {msg.countdown <= 10 ? "🔥" : "⏱"} {msg.countdown}s
                  </div>
                )}
                {msg.deleteMode === "session" && (
                  <div className="text-[9px] text-white/30">
                    🔒 Oturum sonunda silinir
                  </div>
                )}
                {msg.deleteMode === "5m" && msg.countdown === null && (
                  <div className="text-[9px] text-white/30">
                    ⏱ 5 dk sonra silinir
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            data-ocid="ghostchat.empty_state"
          >
            <div
              className="text-5xl mb-4"
              style={{ filter: "drop-shadow(0 0 20px rgba(0,255,247,0.4))" }}
            >
              👻
            </div>
            <p
              className="text-sm font-bold uppercase tracking-widest mb-1"
              style={{ color: "#00fff7" }}
            >
              Ghost Kanal Aktif
            </p>
            <p className="text-xs text-white/40">
              Tüm mesajlar şifreli • Oturum sonunda otomatik silinir
            </p>
          </div>
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
            style={{
              borderColor: "rgba(0,255,247,0.1)",
              background: "rgba(10,15,30,0.98)",
            }}
            data-ocid="ghostchat.popover"
          >
            {input.trim() && (
              <div className="mb-2">
                <p
                  className="text-[9px] uppercase tracking-widest mb-1.5"
                  style={{ color: "#00fff7" }}
                >
                  ✨ AI Önerisi
                </p>
                <div className="flex gap-2">
                  {aiEmojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setInput((p) => p + e);
                      }}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p
              className="text-[9px] uppercase tracking-widest mb-2"
              style={{ color: "#a855f7" }}
            >
              Emojiler
            </p>
            <div className="grid grid-cols-10 gap-1">
              {COMMON_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setInput((p) => p + e);
                  }}
                  className="text-xl hover:scale-125 transition-transform p-1"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 border-t flex gap-3"
            style={{
              borderColor: "rgba(0,255,247,0.1)",
              background: "rgba(10,15,30,0.98)",
            }}
            data-ocid="ghostchat.dropdown_menu"
          >
            {(
              [
                {
                  label: "📷 FOTOĞRAF",
                  sub: "Resim gönder",
                  color: "#00fff7",
                  action: () => photoRef.current?.click(),
                },
                {
                  label: "📄 BELGE",
                  sub: "Dosya gönder",
                  color: "#a855f7",
                  action: () => docRef.current?.click(),
                },
                {
                  label: "📍 KONUM",
                  sub: "Anonim konum",
                  color: "#00ff88",
                  action: handleLocation,
                },
              ] as {
                label: string;
                sub: string;
                color: string;
                action: () => void;
              }[]
            ).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all hover:opacity-90"
                style={{
                  background: `${item.color}10`,
                  border: `1px solid ${item.color}35`,
                }}
              >
                <span className="text-lg">{item.label.split(" ")[0]}</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: item.color }}
                >
                  {item.label.split(" ")[1]}
                </span>
                <span className="text-[9px] text-white/40">{item.sub}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete mode selector */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-t"
        style={{
          borderColor: "rgba(0,255,247,0.08)",
          background: "rgba(6,8,18,0.9)",
        }}
      >
        <span className="text-[9px] text-white/30 uppercase tracking-widest shrink-0">
          Otomatik Sil:
        </span>
        {[
          { id: "30s" as AutoDeleteMode, label: "🔥 30s" },
          { id: "5m" as AutoDeleteMode, label: "⏱ 5dk" },
          { id: "session" as AutoDeleteMode, label: "🔒 Oturum" },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setDeleteMode(opt.id)}
            className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider transition-all"
            style={{
              background:
                deleteMode === opt.id
                  ? "rgba(0,255,247,0.18)"
                  : "rgba(255,255,255,0.04)",
              border:
                deleteMode === opt.id
                  ? "1px solid rgba(0,255,247,0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
              color: deleteMode === opt.id ? "#00fff7" : "#a7b0c2",
            }}
            data-ocid={`ghostchat.${opt.id}_delete.toggle`}
          >
            {opt.label}
          </button>
        ))}
      </div>

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
          placeholder="Mesajını yaz... (şifreli)"
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
                silinecek. Bu işlem geri alınamaz.
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
    </div>
  );
}
