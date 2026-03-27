import GhostCallOverlay from "@/components/GhostCallOverlay";
import { useActor } from "@/hooks/useActor";
import { Copy, LogOut, Phone, Send, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface GhostGroupPageProps {
  onBack: () => void;
}

type AutoDeleteMode = "30s" | "2m" | "5m" | "session";

interface GroupMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  expiresAt: number | null;
}

function genGhostId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "GHOST-";
  for (let i = 0; i < 4; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function genGroupCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "GHOST-";
  for (let i = 0; i < 4; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const DELETE_OPTIONS: { label: string; value: AutoDeleteMode }[] = [
  { label: "30 SNY", value: "30s" },
  { label: "2 DK", value: "2m" },
  { label: "5 DK", value: "5m" },
  { label: "OTURUM SONU", value: "session" },
];

const EMOJIS = [
  "😊",
  "😂",
  "❤️",
  "🔥",
  "✨",
  "🙏",
  "💯",
  "😎",
  "🎉",
  "🔒",
  "💀",
  "⚡",
  "🌐",
  "👻",
  "🚀",
];

export default function GhostGroupPage({ onBack }: GhostGroupPageProps) {
  const { actor, isFetching } = useActor();
  const [myId] = useState(genGhostId);
  const [phase, setPhase] = useState<"lobby" | "chat">("lobby");
  const [groupCode, setGroupCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [deleteMode, setDeleteMode] = useState<AutoDeleteMode>("session");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastTimestamp, setLastTimestamp] = useState<bigint>(BigInt(0));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // Auto-delete expired messages
  useEffect(() => {
    if (phase !== "chat") return;
    const iv = setInterval(() => {
      setMessages((prev) =>
        prev.filter((m) => m.expiresAt === null || m.expiresAt > Date.now()),
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Poll for messages
  const pollMessages = useCallback(async () => {
    if (!actor || !groupCode) return;
    try {
      const raw = await (actor as any).getGroupMessages(
        groupCode,
        myId,
        lastTimestamp,
      );
      if (raw && raw.length > 0) {
        const newMsgs: GroupMessage[] = raw.map(
          ([senderId, content, ts]: [string, string, bigint]) => {
            let expiresAt: number | null = null;
            if (deleteMode === "30s")
              expiresAt = Number(ts) / 1_000_000 + 30000;
            else if (deleteMode === "2m")
              expiresAt = Number(ts) / 1_000_000 + 120000;
            else if (deleteMode === "5m")
              expiresAt = Number(ts) / 1_000_000 + 300000;
            return {
              id: `${senderId}-${ts}`,
              senderId,
              content,
              timestamp: Number(ts) / 1_000_000,
              expiresAt,
            };
          },
        );
        const maxTs = raw.reduce(
          (max: bigint, [, , ts]: [string, string, bigint]) =>
            ts > max ? ts : max,
          lastTimestamp,
        );
        setLastTimestamp(maxTs + BigInt(1));
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...prev, ...newMsgs.filter((m) => !ids.has(m.id))];
        });
      }

      // Refresh member list
      const memberList = await (actor as any).listGroupMembers(groupCode, myId);
      if (memberList) setMembers(memberList);
    } catch (_e) {
      // silent
    }
  }, [actor, groupCode, myId, lastTimestamp, deleteMode]);

  useEffect(() => {
    if (phase !== "chat") return;
    pollRef.current = setInterval(pollMessages, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, pollMessages]);

  async function handleCreateGroup() {
    setLoading(true);
    setError("");
    const code = genGroupCode();
    try {
      if (actor && !isFetching) {
        await (actor as any).createGroupChannel(code, myId);
      }
      setGroupCode(code);
      setMembers([myId]);
      setPhase("chat");
    } catch (_e) {
      // fallback to local mode
      setGroupCode(code);
      setMembers([myId]);
      setPhase("chat");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup() {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError("");
    try {
      if (actor && !isFetching) {
        const result = await (actor as any).joinGroupChannel(code, myId);
        if (typeof result === "string" && result.startsWith("ERROR")) {
          setError(result);
          setLoading(false);
          return;
        }
      }
      setGroupCode(code);
      setMembers([myId]);
      setPhase("chat");
    } catch (_e) {
      setGroupCode(code);
      setMembers([myId]);
      setPhase("chat");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    const content = inputText.trim();
    if (!content) return;
    setInputText("");
    setShowEmoji(false);

    // Optimistic update
    const now = Date.now();
    let expiresAt: number | null = null;
    if (deleteMode === "30s") expiresAt = now + 30000;
    else if (deleteMode === "2m") expiresAt = now + 120000;
    else if (deleteMode === "5m") expiresAt = now + 300000;

    const localMsg: GroupMessage = {
      id: `local-${now}`,
      senderId: myId,
      content,
      timestamp: now,
      expiresAt,
    };
    setMessages((prev) => [...prev, localMsg]);

    try {
      if (actor && !isFetching) {
        await (actor as any).sendGroupMessage(groupCode, myId, content);
      }
    } catch (_e) {
      // local only
    }
  }

  async function handleLeave() {
    setTerminating(true);
    try {
      if (actor && !isFetching) {
        await (actor as any).leaveGroupChannel(groupCode, myId);
      }
    } catch (_e) {
      // silent
    }
    setMessages([]);
    setMembers([]);
    setTimeout(() => onBack(), 1800);
  }

  function copyCode() {
    navigator.clipboard.writeText(groupCode).catch(() => {});
  }

  if (terminating) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: "#060812" }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl"
        >
          💀
        </motion.div>
        <div
          className="text-lg font-bold tracking-widest uppercase text-center"
          style={{ color: "#00fff7", fontFamily: "monospace" }}
        >
          TÜM VERİ SİLİNDİ
        </div>
        <div
          className="text-xs tracking-wider uppercase"
          style={{ color: "#a7b0c2", fontFamily: "monospace" }}
        >
          Grup oturumu sonlandırıldı
        </div>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{
          background: "linear-gradient(180deg, #060812 0%, #0a0f1e 100%)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">👥</div>
            <h1
              className="text-2xl font-bold tracking-widest uppercase mb-1"
              style={{ color: "#00fff7", fontFamily: "monospace" }}
            >
              GHOST GROUP
            </h1>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "#a7b0c2", fontFamily: "monospace" }}
            >
              Anonim • Şifreli • Geçici
            </p>
            <div
              className="mt-3 text-[10px] px-4 py-1.5 rounded-full inline-block"
              style={{
                fontFamily: "monospace",
                color: "#a855f7",
                border: "1px solid rgba(168,85,247,0.3)",
                background: "rgba(168,85,247,0.08)",
              }}
            >
              🔐 {myId}
            </div>
          </div>

          <div
            className="rounded-2xl p-6 mb-4"
            style={{
              background: "rgba(0,255,247,0.03)",
              border: "1px solid rgba(0,255,247,0.12)",
            }}
          >
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold tracking-widest uppercase text-sm mb-4 transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,255,247,0.2), rgba(0,255,247,0.05))",
                border: "1px solid rgba(0,255,247,0.5)",
                color: "#00fff7",
                boxShadow: "0 0 20px rgba(0,255,247,0.15)",
                fontFamily: "monospace",
              }}
              data-ocid="ghost_group.create.primary_button"
            >
              {loading ? "OLUŞTURULUYOR..." : "+ YENİ GRUP OLUŞTUR"}
            </button>

            <div
              className="text-center text-xs mb-4 uppercase tracking-widest"
              style={{ color: "#a7b0c2", fontFamily: "monospace" }}
            >
              — veya —
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="GHOST-XXXX gir..."
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinGroup()}
                className="flex-1 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest outline-none"
                style={{
                  background: "rgba(168,85,247,0.08)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  color: "#e879f9",
                  fontFamily: "monospace",
                }}
                data-ocid="ghost_group.join_code.input"
              />
              <button
                type="button"
                onClick={handleJoinGroup}
                disabled={loading || !joinCodeInput.trim()}
                className="px-4 py-2.5 rounded-xl font-bold uppercase text-xs tracking-widest transition-all hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "rgba(168,85,247,0.2)",
                  border: "1px solid rgba(168,85,247,0.5)",
                  color: "#e879f9",
                  fontFamily: "monospace",
                }}
                data-ocid="ghost_group.join.button"
              >
                KATIL
              </button>
            </div>

            {error && (
              <div
                className="mt-3 text-[10px] text-center uppercase tracking-widest"
                style={{ color: "#ff3250", fontFamily: "monospace" }}
                data-ocid="ghost_group.join.error_state"
              >
                ⚠ {error}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all hover:opacity-70"
            style={{ color: "#a7b0c2", fontFamily: "monospace" }}
            data-ocid="ghost_group.back.button"
          >
            ← GERİ
          </button>
        </motion.div>
      </div>
    );
  }

  // Chat phase
  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "#060812" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          borderColor: "rgba(0,255,247,0.15)",
          background: "rgba(6,8,18,0.97)",
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
            data-ocid="ghost_group.close_button"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <div
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "#00fff7", fontFamily: "monospace" }}
            >
              👥 GHOST GROUP
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#00ff88" }}
              />
              <span className="text-[10px] text-green-400 uppercase tracking-wider">
                {members.length} Üye
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Group code copy */}
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full transition-all hover:opacity-80"
            style={{
              fontFamily: "monospace",
              color: "#a855f7",
              border: "1px solid rgba(168,85,247,0.3)",
              background: "rgba(168,85,247,0.08)",
            }}
            data-ocid="ghost_group.copy_code.button"
          >
            <Copy className="w-2.5 h-2.5" />
            {groupCode}
          </button>

          {/* Members toggle */}
          <button
            type="button"
            onClick={() => setShowMembers((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              border: showMembers
                ? "1px solid rgba(0,255,247,0.6)"
                : "1px solid rgba(0,255,247,0.2)",
              color: "#00fff7",
            }}
            data-ocid="ghost_group.members.toggle"
          >
            <Users className="w-3.5 h-3.5" />
          </button>

          {/* Call button */}
          <button
            type="button"
            onClick={() => setShowCallOverlay(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest transition-all hover:opacity-90"
            style={{
              background: "rgba(255,50,80,0.15)",
              border: "1px solid rgba(255,50,80,0.4)",
              color: "#ff3250",
              fontFamily: "monospace",
            }}
            data-ocid="ghost_group.call.button"
          >
            <Phone className="w-3 h-3" />
            ARAMA
          </button>
        </div>
      </header>

      {/* Members sidebar */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
            style={{
              background: "rgba(0,255,247,0.03)",
              borderBottom: "1px solid rgba(0,255,247,0.1)",
            }}
            data-ocid="ghost_group.members.panel"
          >
            <div className="px-4 py-3 flex flex-wrap gap-2">
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#a7b0c2", fontFamily: "monospace" }}
              >
                Üyeler:
              </span>
              {members.map((m, i) => (
                <span
                  key={`member-${m}`}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    fontFamily: "monospace",
                    color: m === myId ? "#00fff7" : "#a855f7",
                    border: `1px solid ${m === myId ? "rgba(0,255,247,0.4)" : "rgba(168,85,247,0.3)"}`,
                    background:
                      m === myId
                        ? "rgba(0,255,247,0.08)"
                        : "rgba(168,85,247,0.08)",
                  }}
                  data-ocid={`ghost_group.member.item.${i + 1}`}
                >
                  {m === myId ? `👤 Sen (${m})` : `👻 ${m}`}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete mode bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0 overflow-x-auto"
        style={{
          borderBottom: "1px solid rgba(0,255,247,0.08)",
          background: "rgba(6,8,18,0.9)",
        }}
      >
        <span
          className="text-[9px] uppercase tracking-widest shrink-0"
          style={{ color: "#a7b0c2", fontFamily: "monospace" }}
        >
          ⏱ Sil:
        </span>
        {DELETE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDeleteMode(opt.value)}
            className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest transition-all shrink-0"
            style={{
              background:
                deleteMode === opt.value
                  ? "rgba(168,85,247,0.25)"
                  : "rgba(168,85,247,0.05)",
              border:
                deleteMode === opt.value
                  ? "1px solid rgba(168,85,247,0.7)"
                  : "1px solid rgba(168,85,247,0.15)",
              color: deleteMode === opt.value ? "#e879f9" : "#a7b0c2",
              fontFamily: "monospace",
            }}
            data-ocid={`ghost_group.delete_mode.${opt.value}.toggle`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-full gap-3"
            data-ocid="ghost_group.messages.empty_state"
          >
            <span className="text-4xl opacity-30">👥</span>
            <p
              className="text-xs uppercase tracking-widest text-center"
              style={{ color: "#a7b0c2", fontFamily: "monospace" }}
            >
              Grup aktif • İlk mesajı gönder
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => {
            const isMe = msg.senderId === myId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                data-ocid={`ghost_group.messages.item.${i + 1}`}
              >
                <div
                  className="max-w-[75%] rounded-2xl px-4 py-2.5"
                  style={{
                    background: isMe
                      ? "rgba(0,255,247,0.12)"
                      : "rgba(168,85,247,0.1)",
                    border: isMe
                      ? "1px solid rgba(0,255,247,0.25)"
                      : "1px solid rgba(168,85,247,0.2)",
                  }}
                >
                  {!isMe && (
                    <div
                      className="text-[9px] font-bold mb-1 uppercase tracking-wider"
                      style={{ color: "#a855f7", fontFamily: "monospace" }}
                    >
                      {msg.senderId}
                    </div>
                  )}
                  <div
                    className="text-sm"
                    style={{ color: isMe ? "#00fff7" : "#e2e8f0" }}
                  >
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 shrink-0"
            style={{
              background: "rgba(0,255,247,0.04)",
              borderTop: "1px solid rgba(0,255,247,0.1)",
            }}
          >
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setInputText((t) => t + e)}
                  className="text-xl hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{
          borderTop: "1px solid rgba(0,255,247,0.15)",
          background: "rgba(6,8,18,0.97)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className="text-xl w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
          style={{
            border: "1px solid rgba(0,255,247,0.2)",
            color: "#00fff7",
          }}
          data-ocid="ghost_group.emoji.button"
        >
          😊
        </button>
        <input
          type="text"
          placeholder="Mesaj yaz..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: "rgba(0,255,247,0.06)",
            border: "1px solid rgba(0,255,247,0.2)",
            color: "#e2e8f0",
            fontFamily: "monospace",
          }}
          data-ocid="ghost_group.message.input"
        />
        <button
          type="button"
          onClick={handleSendMessage}
          disabled={!inputText.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-40"
          style={{
            background: "rgba(0,255,247,0.15)",
            border: "1px solid rgba(0,255,247,0.5)",
            color: "#00fff7",
          }}
          data-ocid="ghost_group.send.button"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* End confirm dialog */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(6,8,18,0.92)" }}
            data-ocid="ghost_group.exit.dialog"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-xs rounded-2xl p-6 text-center"
              style={{
                background: "#0a0f1e",
                border: "1px solid rgba(255,50,80,0.4)",
              }}
            >
              <div className="text-3xl mb-3">💀</div>
              <div
                className="text-sm font-bold tracking-widest uppercase mb-2"
                style={{ color: "#ff3250", fontFamily: "monospace" }}
              >
                Grubu Terk Et?
              </div>
              <div
                className="text-xs mb-5"
                style={{ color: "#a7b0c2", fontFamily: "monospace" }}
              >
                Tüm mesajlar ve grup verisi silinecek.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest"
                  style={{
                    border: "1px solid rgba(0,255,247,0.3)",
                    color: "#00fff7",
                    fontFamily: "monospace",
                  }}
                  data-ocid="ghost_group.exit.cancel_button"
                >
                  İPTAL
                </button>
                <button
                  type="button"
                  onClick={handleLeave}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest"
                  style={{
                    background: "rgba(255,50,80,0.2)",
                    border: "1px solid rgba(255,50,80,0.5)",
                    color: "#ff3250",
                    fontFamily: "monospace",
                  }}
                  data-ocid="ghost_group.exit.confirm_button"
                >
                  <LogOut className="w-3 h-3 inline mr-1" />
                  TERK ET
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost call overlay */}
      <GhostCallOverlay
        isOpen={showCallOverlay}
        onClose={() => setShowCallOverlay(false)}
        callerIds={members.filter((m) => m !== myId)}
        isGroup
      />
    </div>
  );
}
