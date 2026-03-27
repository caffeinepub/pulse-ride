import { Progress } from "@/components/ui/progress";
import {
  Award,
  ChevronLeft,
  Copy,
  Ghost,
  Mic,
  MicOff,
  RefreshCw,
  Share2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface ViralModePageProps {
  onBack: () => void;
}

type Tab = "snapshots" | "phantom" | "games" | "leaderboard" | "challenges";

const TABS: { id: Tab; label: string }[] = [
  { id: "snapshots", label: "SNAPSHOTS" },
  { id: "phantom", label: "PHANTOM" },
  { id: "games", label: "MINI GAMES" },
  { id: "leaderboard", label: "LEADERBOARD" },
  { id: "challenges", label: "CHALLENGES" },
];

const SNAPSHOT_DATA = [
  {
    id: "GHOST-4821",
    km: "12.4",
    min: "18",
    mood: "🔥",
    phantom: true,
    views: 3421,
  },
  {
    id: "GHOST-7293",
    km: "8.1",
    min: "12",
    mood: "💫",
    phantom: false,
    views: 2187,
  },
  {
    id: "GHOST-1056",
    km: "22.7",
    min: "35",
    mood: "⚡",
    phantom: true,
    views: 5902,
  },
  {
    id: "GHOST-9934",
    km: "5.3",
    min: "9",
    mood: "🔥",
    phantom: false,
    views: 1324,
  },
];

const PHANTOM_TEASERS = [
  {
    id: "PHANTOM-3",
    msg: "Phantom #3 was here... 🌀 Route: CLASSIFIED",
    zone: "ZONE-7",
  },
  {
    id: "PHANTOM-7",
    msg: "Ghost signal detected: Zone-7 encrypted 👁️",
    zone: "ZONE-12",
  },
  {
    id: "PHANTOM-11",
    msg: "🔮 AI shadow navigated 18 km. Destination: UNKNOWN",
    zone: "ZONE-3",
  },
];

const PHANTOM_AI_MESSAGES: Record<string, string[]> = {
  "PHANTOM-3": [
    "▓▒░ ROTA ŞİFRELENDİ — AI navigasyon aktif. Varış: SINIFLANDIRILMIŞ",
    "Bilinmeyen sinyal: Zone-7 // Şifreli güzergah yükleniyor...",
    "AI gölge modu: 3 sahte konum yayınlanıyor",
    "Phantom sürücü tespit edildi — kimlik: NULL",
  ],
  "PHANTOM-7": [
    "👁️ Şifreli sinyal aktarılıyor... Zone-12 // hedef belirsiz",
    "AI mesaj maskesi aktif: ses değiştirici ON",
    "Hayalet bağlantı kuruldu — yolculuk süresi: DELETED",
    "Zone-12 // GPS karıştırıcı çalışıyor",
  ],
  "PHANTOM-11": [
    "🔮 18 km AI navigasyon — tüm veriler silindi",
    "Gizli rota tamamlandı: UNKNOWN // veri ömrü: 0s",
    "Phantom #11 sinyali son 3 kez tespit edildi — konum: YALNIZCA AI BİLİR",
    "Şifreli iz: ████ km // varış noktası: KLASİFİYE",
  ],
};

const TRIVIA_QUESTIONS = [
  {
    q: "İstanbul'da kaç köprü vardır?",
    options: ["2", "3", "5"],
    correct: 1,
  },
  {
    q: "Dünya'nın en kalabalık şehri hangisidir?",
    options: ["Tokyo", "Shanghai", "Mumbai"],
    correct: 0,
  },
  {
    q: "Otonom araçlar hangi teknolojiyi kullanır?",
    options: ["LIDAR", "GPS Only", "Radio"],
    correct: 0,
  },
  {
    q: "Bir sürücü lisansı kaç yılda bir yenilenir?",
    options: ["5 yıl", "10 yıl", "3 yıl"],
    correct: 0,
  },
  {
    q: "Pulse Ride'da tüm veriler ne zaman silinir?",
    options: ["Yolculuk biter bitmez", "24 saat sonra", "Hiçbir zaman"],
    correct: 0,
  },
];

const EMOJI_PAIRS = [
  ["🔥", "❄️"],
  ["⚡", "🌀"],
  ["👻", "🤖"],
];

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function useViewCounter(initial: number, active: boolean) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setCount((c) => c + 1), 3000);
    return () => clearInterval(id);
  }, [active]);
  return count;
}

function WaveBar({ delay }: { delay: number }) {
  return (
    <div
      className="w-1 rounded-full animate-waveform"
      style={{
        height: `${Math.random() * 16 + 8}px`,
        background: "linear-gradient(to top, #2ee6d6, #a855ff)",
        animationDelay: `${delay}s`,
      }}
    />
  );
}

function copyLink(label: string) {
  const fakeUrl = `https://pulseride.app/share/${label.toLowerCase().replace(" ", "-")}-${Math.random().toString(36).slice(2, 7)}`;
  navigator.clipboard.writeText(fakeUrl).then(() => {
    toast.success("Anonim link kopyalandı! 🔗");
  });
}

// ──────────────────────────────────────────────────────────
// PULSE VOICE PANEL
// ──────────────────────────────────────────────────────────
interface VoiceBooster {
  emoji: string;
  label: string;
}

function PulseVoicePanel({
  onBooster,
}: { onBooster: (emoji: string, label: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [booster, setBooster] = useState<VoiceBooster | null>(null);
  const [micError, setMicError] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(Array(8).fill(8));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopRecording = useCallback(
    (analyser: AnalyserNode) => {
      cancelAnimationFrame(animFrameRef.current);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArr);
      const avg =
        dataArr.reduce((acc, v) => acc + Math.abs(v - 128), 0) / dataArr.length;

      let emoji = "🌀";
      let label = "GHOST BOOST";
      if (avg > 180) {
        emoji = "⚡";
        label = "LIGHTNING BOOST";
      } else if (avg > 120) {
        emoji = "🔥";
        label = "FIRE BOOST";
      } else if (avg > 60) {
        emoji = "💫";
        label = "PULSE BOOST";
      }

      setBooster({ emoji, label });
      setRecording(false);
      setBarHeights(Array(8).fill(8));
      onBooster(emoji, label);

      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    },
    [onBooster],
  );

  const startRecording = async () => {
    setMicError(false);
    setBooster(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);

      // Animate bars
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArr);
        const step = Math.floor(dataArr.length / 8);
        const heights = Array.from({ length: 8 }, (_, i) => {
          const val = dataArr[i * step] / 255;
          return 4 + val * 36;
        });
        setBarHeights(heights);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Auto-stop after 2s
      setTimeout(() => {
        if (mr.state !== "inactive") mr.stop();
        for (const t of stream.getTracks()) {
          t.stop();
        }
        stopRecording(analyser);
      }, 2000);
    } catch {
      setMicError(true);
    }
  };

  return (
    <div
      className="rounded-2xl p-5 mb-5"
      style={{
        background: "rgba(46,230,214,0.04)",
        border: "1px solid rgba(46,230,214,0.3)",
        boxShadow: "0 0 20px rgba(46,230,214,0.06)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-sm font-black uppercase tracking-widest"
          style={{ color: "#2ee6d6" }}
        >
          ⚡ PULSE NABIZ — SES GİRİŞİ
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={recording ? undefined : startRecording}
          disabled={recording}
          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all"
          style={{
            background: recording
              ? "linear-gradient(135deg, rgba(46,230,214,0.3), rgba(46,230,214,0.15))"
              : "linear-gradient(135deg, rgba(46,230,214,0.2), rgba(46,230,214,0.08))",
            border: `2px solid ${recording ? "rgba(46,230,214,0.8)" : "rgba(46,230,214,0.4)"}`,
            boxShadow: recording ? "0 0 20px rgba(46,230,214,0.4)" : "none",
          }}
          data-ocid="games.voice.record_button"
        >
          {recording ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
            >
              <Mic className="w-5 h-5" style={{ color: "#2ee6d6" }} />
            </motion.div>
          ) : (
            <Mic className="w-5 h-5" style={{ color: "#2ee6d6" }} />
          )}
        </button>

        {/* Waveform bars */}
        {recording ? (
          <div className="flex items-end gap-0.5 h-10 flex-1">
            {barHeights.map((h, i) => {
              const barKey = `wave-bar-${i}`;
              return (
                <motion.div
                  key={barKey}
                  className="flex-1 rounded-full"
                  animate={{ height: h }}
                  transition={{ duration: 0.05 }}
                  style={{
                    background: "linear-gradient(to top, #2ee6d6, #a855ff)",
                    minHeight: 4,
                  }}
                />
              );
            })}
          </div>
        ) : booster ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 flex-1"
          >
            <motion.span
              animate={{
                textShadow: [
                  "0 0 8px #2ee6d6",
                  "0 0 20px #2ee6d6",
                  "0 0 8px #2ee6d6",
                ],
              }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
              className="text-2xl"
            >
              {booster.emoji}
            </motion.span>
            <div>
              <p
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "#2ee6d6" }}
              >
                {booster.label}
              </p>
              <p className="text-[10px] text-[#a7b0c2]">Pulse Nabız aktif 🎙️</p>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1">
            <p className="text-xs text-[#a7b0c2]">
              Mikrofona bas, sesin güçüyle booster kazan
            </p>
            <p className="text-[10px] text-[#a7b0c2]/60">
              2 saniyelik ses analizi
            </p>
          </div>
        )}

        {booster && !recording && (
          <button
            type="button"
            onClick={() => {
              setBooster(null);
            }}
            className="p-1.5 rounded-lg"
            style={{ background: "rgba(46,230,214,0.1)", color: "#2ee6d6" }}
            data-ocid="games.voice.reset_button"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {micError && (
        <p className="text-xs mt-2" style={{ color: "#f87171" }}>
          Mikrofon izni gerekli 🎙️
        </p>
      )}

      {recording && (
        <p className="text-[10px] text-[#2ee6d6] mt-2 font-mono animate-pulse">
          ● Kayıt ediliyor... 2s
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PHANTOM AI MESSAGE
// ──────────────────────────────────────────────────────────
function PhantomAIMessage({ phantomId }: { phantomId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [usedIndices, setUsedIndices] = useState<number[]>([]);

  const pool =
    PHANTOM_AI_MESSAGES[phantomId] ?? PHANTOM_AI_MESSAGES["PHANTOM-3"];

  const generate = () => {
    if (loading || typing) return;
    setLoading(true);
    setMessage(null);
    setTyped("");

    setTimeout(() => {
      const available = pool
        .map((_, i) => i)
        .filter((i) => !usedIndices.includes(i));
      const candidates =
        available.length > 0 ? available : pool.map((_, i) => i);
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      const msg = pool[idx];
      setUsedIndices((prev) => {
        const next = [...prev, idx];
        return next.length >= pool.length ? [] : next;
      });
      setMessage(msg);
      setLoading(false);
      setTyping(true);

      // Typewriter
      let charIdx = 0;
      const interval = setInterval(() => {
        charIdx++;
        setTyped(msg.slice(0, charIdx));
        if (charIdx >= msg.length) {
          clearInterval(interval);
          setTyping(false);
        }
      }, 30);
    }, 1500);
  };

  const copyMessage = () => {
    if (!message) return;
    navigator.clipboard
      .writeText(message)
      .then(() => toast.success("Mesaj kopyalandı! 🔗"));
  };

  const reset = () => {
    setMessage(null);
    setTyped("");
    setTyping(false);
  };

  const isDone = message !== null && !typing;

  return (
    <div
      className="mt-4 rounded-xl p-4"
      style={{
        background: "rgba(10,8,22,0.8)",
        border: "1px solid rgba(168,85,255,0.4)",
      }}
    >
      {!message && !loading && (
        <button
          type="button"
          onClick={generate}
          className="w-full py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:opacity-80"
          style={{
            background:
              "linear-gradient(135deg, rgba(168,85,255,0.2), rgba(168,85,255,0.08))",
            border: "1px solid rgba(168,85,255,0.5)",
            color: "#e9d5ff",
          }}
          data-ocid="phantom.ai_message.generate_button"
        >
          🔮 AI MESAJ ÜRET
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{
                duration: 0.8,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.2,
              }}
              style={{ background: "#a855ff" }}
            />
          ))}
          <span className="text-xs text-[#c084fc] ml-1">
            AI mesaj üretiyor...
          </span>
        </div>
      )}

      {(typing || isDone) && message && (
        <div>
          <p
            className="text-sm leading-relaxed mb-3"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: "#2ee6d6",
              letterSpacing: "0.02em",
            }}
          >
            {typed}
            {typing && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
                style={{ color: "#2ee6d6" }}
              >
                |
              </motion.span>
            )}
          </p>

          {isDone && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyMessage}
                className="flex-1 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                style={{
                  background: "rgba(46,230,214,0.1)",
                  border: "1px solid rgba(46,230,214,0.3)",
                  color: "#2ee6d6",
                }}
                data-ocid="phantom.ai_message.copy_button"
              >
                <Copy className="w-3 h-3" /> KOPYALA
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex-1 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                style={{
                  background: "rgba(168,85,255,0.1)",
                  border: "1px solid rgba(168,85,255,0.3)",
                  color: "#c084fc",
                }}
                data-ocid="phantom.ai_message.refresh_button"
              >
                <RefreshCw className="w-3 h-3" /> YENİLE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SNAPSHOTS TAB
// ──────────────────────────────────────────────────────────
function SnapshotsTab() {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {SNAPSHOT_DATA.map((snap, i) => (
        <motion.div
          key={snap.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(168,85,255,0.12) 0%, rgba(46,230,214,0.08) 100%)",
            border: "1px solid rgba(168,85,255,0.3)",
            boxShadow: "0 0 24px rgba(168,85,255,0.1)",
          }}
          data-ocid={`snapshots.item.${i + 1}`}
        >
          {/* AI badge */}
          <div
            className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
            style={{
              background: "rgba(46,230,214,0.15)",
              border: "1px solid rgba(46,230,214,0.4)",
              color: "#2ee6d6",
            }}
          >
            GENERATED BY AI
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{
                background: "rgba(168,85,255,0.2)",
                border: "1px solid rgba(168,85,255,0.4)",
              }}
            >
              👤
            </div>
            <div>
              <p
                className="text-xs font-black tracking-widest"
                style={{ color: "#a855ff" }}
              >
                {snap.id}
              </p>
              {snap.phantom && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style={{
                    background: "rgba(168,85,255,0.2)",
                    color: "#c084fc",
                    border: "1px solid rgba(168,85,255,0.4)",
                  }}
                >
                  👻 PHANTOM
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-xl font-black text-white">{snap.km}</p>
              <p className="text-[10px] text-[#a7b0c2] uppercase">km</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-white">{snap.min}</p>
              <p className="text-[10px] text-[#a7b0c2] uppercase">min</p>
            </div>
            <div className="text-center">
              <p className="text-2xl">{snap.mood}</p>
              <p className="text-[10px] text-[#a7b0c2] uppercase">mood</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-mono" style={{ color: "#2ee6d6" }}>
                👁 {(snap.views / 1000).toFixed(1)}K
              </p>
              <p className="text-[10px] text-[#a7b0c2] uppercase">views</p>
            </div>
          </div>

          {/* Waveform */}
          <div className="flex items-end gap-0.5 h-6 mb-4">
            {[..."0123456789abcdef"].map((id, j) => (
              <WaveBar key={id} delay={j * 0.07} />
            ))}
          </div>

          {/* Share buttons */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "TikTok", color: "#ff0050" },
              { label: "Reels", color: "#e040fb" },
              { label: "Shorts", color: "#ff0000" },
            ].map((platform) => (
              <button
                key={platform.label}
                type="button"
                onClick={() => copyLink(`${snap.id}-${platform.label}`)}
                className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider transition-opacity hover:opacity-80"
                style={{
                  background: `${platform.color}22`,
                  border: `1px solid ${platform.color}55`,
                  color: platform.color,
                }}
                data-ocid={`snapshots.item.${i + 1}.button`}
              >
                {platform.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => copyLink(snap.id)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1"
              style={{
                background: "rgba(46,230,214,0.1)",
                border: "1px solid rgba(46,230,214,0.3)",
                color: "#2ee6d6",
              }}
              data-ocid={`snapshots.copy_link.button.${i + 1}`}
            >
              <Copy className="w-3 h-3" /> COPY LINK
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PHANTOM TAB
// ──────────────────────────────────────────────────────────
function PhantomTab() {
  const counts = [
    useViewCounter(1200, true),
    useViewCounter(870, true),
    useViewCounter(3400, true),
  ];

  return (
    <div className="space-y-5">
      {PHANTOM_TEASERS.map((teaser, i) => (
        <motion.div
          key={teaser.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, duration: 0.5 }}
          className="relative rounded-2xl p-6 overflow-hidden"
          style={{
            background: "rgba(10,8,22,0.9)",
            border: "1px solid rgba(168,85,255,0.4)",
            boxShadow:
              "0 0 30px rgba(168,85,255,0.15), inset 0 0 40px rgba(168,85,255,0.04)",
          }}
          data-ocid={`phantom.item.${i + 1}`}
        >
          <motion.div
            animate={{
              borderColor: [
                "rgba(168,85,255,0.2)",
                "rgba(168,85,255,0.7)",
                "rgba(168,85,255,0.2)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
            }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ border: "1px solid rgba(168,85,255,0.3)" }}
          />

          <div className="flex items-start gap-4">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.3,
              }}
              className="text-5xl select-none"
            >
              👻
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-black tracking-widest"
                  style={{
                    color: "#c084fc",
                    textShadow: "0 0 12px rgba(168,85,255,0.8)",
                  }}
                >
                  {teaser.id}
                </span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: "rgba(168,85,255,0.2)",
                    border: "1px solid rgba(168,85,255,0.5)",
                    color: "#e9d5ff",
                    boxShadow: "0 0 8px rgba(168,85,255,0.4)",
                  }}
                >
                  ✦ PHANTOM
                </span>
              </div>
              <p className="text-sm text-[#d8b4fe] leading-relaxed mb-3 italic">
                {teaser.msg}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a7b0c2]">
                  👁 {counts[i].toLocaleString()} views
                </span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(168,85,255,0.1)",
                    color: "#c084fc",
                  }}
                >
                  {teaser.zone}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => copyLink(teaser.id)}
              className="flex-1 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-80"
              style={{
                background:
                  "linear-gradient(135deg, rgba(168,85,255,0.3), rgba(168,85,255,0.15))",
                border: "1px solid rgba(168,85,255,0.5)",
                color: "#e9d5ff",
                boxShadow: "0 0 16px rgba(168,85,255,0.2)",
              }}
              data-ocid={`phantom.item.${i + 1}.button`}
            >
              TEASER YAYINLA
            </button>
            <button
              type="button"
              onClick={() => copyLink(`${teaser.id}-link`)}
              className="px-4 py-2.5 rounded-full transition-opacity hover:opacity-80"
              style={{
                background: "rgba(168,85,255,0.1)",
                border: "1px solid rgba(168,85,255,0.3)",
                color: "#c084fc",
              }}
              data-ocid={`phantom.share.button.${i + 1}`}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          <PhantomAIMessage phantomId={teaser.id} />
        </motion.div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MINI GAMES TAB
// ──────────────────────────────────────────────────────────
function ReactionGame({ voiceBooster }: { voiceBooster: VoiceBooster | null }) {
  const [phase, setPhase] = useState<"wait" | "ready" | "go" | "result">(
    "wait",
  );
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [booster, setBooster] = useState<string | null>(null);
  const startRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync voice booster into booster state
  useEffect(() => {
    if (voiceBooster) {
      setBooster(voiceBooster.emoji);
    }
  }, [voiceBooster]);

  const grade = (ms: number) =>
    ms < 180
      ? "LIGHTNING ⚡"
      : ms < 280
        ? "FAST 🔥"
        : ms < 450
          ? "OK 👍"
          : "SLOW 🐌";

  const startGame = () => {
    setPhase("ready");
    setReactionMs(null);
    const delay = 1500 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      setPhase("go");
      startRef.current = performance.now();
    }, delay);
  };

  const handleTap = () => {
    if (phase === "go") {
      const elapsed = performance.now() - startRef.current;
      setReactionMs(Math.round(elapsed));
      setPhase("result");
    } else if (phase === "ready") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase("wait");
      toast.error("Çok erken! Tekrar dene 😅");
    }
  };

  const shareResult = () => {
    if (reactionMs) {
      navigator.clipboard
        .writeText(
          `PulseRide Reaction: ${reactionMs}ms — ${grade(reactionMs)} #PulseRide #ViralMod`,
        )
        .then(() => toast.success("Sonuç kopyalandı! 🔗"));
    }
  };

  const BOOSTER_EMOJIS = ["🔥", "💫", "⚡"];

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(46,230,214,0.05)",
        border: "1px solid rgba(46,230,214,0.2)",
      }}
    >
      <h3 className="text-sm font-black uppercase tracking-widest text-white mb-1">
        Reaction Challenge
      </h3>
      <p className="text-xs text-[#a7b0c2] mb-4">
        Ekrana dokun — ne kadar hızlısın?
      </p>

      {phase === "wait" && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {BOOSTER_EMOJIS.map((e) => {
              const isVoice = voiceBooster?.emoji === e;
              const isSelected = booster === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setBooster(e)}
                  className="text-xl px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: isSelected
                      ? "rgba(46,230,214,0.2)"
                      : "rgba(255,255,255,0.05)",
                    border: isVoice
                      ? "2px solid rgba(46,230,214,0.8)"
                      : `1px solid ${isSelected ? "rgba(46,230,214,0.5)" : "rgba(255,255,255,0.1)"}`,
                    boxShadow: isVoice
                      ? "0 0 12px rgba(46,230,214,0.5)"
                      : "none",
                  }}
                  data-ocid={"games.reaction.toggle"}
                >
                  {e}
                  {isVoice && (
                    <span className="ml-1 text-[10px] text-[#2ee6d6]">🎙️</span>
                  )}
                </button>
              );
            })}
            {booster && (
              <span className="text-xs text-[#2ee6d6] self-center">
                Booster: {booster}
                {voiceBooster && booster === voiceBooster.emoji && " (Pulse)"}
              </span>
            )}
          </div>
          {voiceBooster && (
            <div
              className="text-[10px] px-2 py-1 rounded mb-3 inline-flex items-center gap-1"
              style={{ background: "rgba(46,230,214,0.1)", color: "#2ee6d6" }}
            >
              🎙️ Pulse Nabız Aktif — {voiceBooster.label}
            </div>
          )}
          <button
            type="button"
            onClick={startGame}
            className="w-full py-3 rounded-full font-bold uppercase tracking-widest text-sm text-black"
            style={{ background: "linear-gradient(135deg, #2ee6d6, #3be7ff)" }}
            data-ocid="games.reaction.primary_button"
          >
            BAŞLA
          </button>
        </div>
      )}

      {phase === "ready" && (
        <motion.button
          type="button"
          onClick={handleTap}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY }}
          className="w-full py-8 rounded-2xl font-bold uppercase tracking-widest text-lg"
          style={{
            background: "rgba(168,85,255,0.15)",
            border: "2px solid rgba(168,85,255,0.5)",
            color: "#c084fc",
          }}
          data-ocid="games.reaction.toggle"
        >
          Bekle...
        </motion.button>
      )}

      {phase === "go" && (
        <motion.button
          type="button"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          onClick={handleTap}
          className="w-full py-8 rounded-2xl font-black uppercase tracking-widest text-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(46,230,214,0.3), rgba(46,230,214,0.15))",
            border: "2px solid rgba(46,230,214,0.8)",
            color: "#2ee6d6",
            boxShadow: "0 0 40px rgba(46,230,214,0.3)",
          }}
          data-ocid="games.reaction.primary_button"
        >
          DOKUN! ⚡
        </motion.button>
      )}

      {phase === "result" && reactionMs !== null && (
        <div className="text-center">
          <p className="text-4xl font-black text-white mb-1">{reactionMs}ms</p>
          <p className="text-lg mb-4" style={{ color: "#2ee6d6" }}>
            {grade(reactionMs)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startGame}
              className="flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                background: "rgba(46,230,214,0.1)",
                border: "1px solid rgba(46,230,214,0.3)",
                color: "#2ee6d6",
              }}
              data-ocid="games.reaction.secondary_button"
            >
              Tekrar
            </button>
            <button
              type="button"
              onClick={shareResult}
              className="flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1"
              style={{
                background: "rgba(168,85,255,0.1)",
                border: "1px solid rgba(168,85,255,0.3)",
                color: "#c084fc",
              }}
              data-ocid="games.reaction.submit_button"
            >
              <Share2 className="w-3 h-3" /> SONUCU PAYLAŞ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TriviaGame({ voiceBooster }: { voiceBooster: VoiceBooster | null }) {
  const [qIndex, setQIndex] = useState(() =>
    Math.floor(Math.random() * TRIVIA_QUESTIONS.length),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [pulseVote, setPulseVote] = useState<string | null>(null);
  const q = TRIVIA_QUESTIONS[qIndex];

  // Map voice booster emoji to pulse vote
  useEffect(() => {
    if (voiceBooster) {
      const map: Record<string, string> = {
        "⚡": "👍",
        "🔥": "👍",
        "💫": "🤔",
        "🌀": "👎",
      };
      const mapped = map[voiceBooster.emoji] ?? "🤔";
      setPulseVote(mapped);
    }
  }, [voiceBooster]);

  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === q.correct) setScore((s) => s + 1);
  };

  const next = () => {
    setSelected(null);
    setQIndex((prev) => (prev + 1) % TRIVIA_QUESTIONS.length);
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(168,85,255,0.05)",
        border: "1px solid rgba(168,85,255,0.2)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          Trivia Quiz
        </h3>
        <div className="flex items-center gap-2">
          {voiceBooster && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                background: "rgba(46,230,214,0.15)",
                border: "1px solid rgba(46,230,214,0.3)",
                color: "#2ee6d6",
              }}
            >
              Pulse Nabız Aktif 🎙️
            </span>
          )}
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(46,230,214,0.15)", color: "#2ee6d6" }}
          >
            Skor: {score}
          </span>
        </div>
      </div>

      <p className="text-sm text-white mb-4 leading-relaxed">{q.q}</p>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => {
          let bg = "rgba(255,255,255,0.05)";
          let border = "rgba(255,255,255,0.1)";
          let color = "#a7b0c2";
          if (selected !== null) {
            if (i === q.correct) {
              bg = "rgba(46,230,214,0.15)";
              border = "rgba(46,230,214,0.5)";
              color = "#2ee6d6";
            } else if (i === selected) {
              bg = "rgba(239,68,68,0.12)";
              border = "rgba(239,68,68,0.4)";
              color = "#f87171";
            }
          }
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(i)}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: bg, border: `1px solid ${border}`, color }}
              data-ocid={"games.trivia.button"}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-[#a7b0c2]">Pulse Oyu:</span>
        {["👍", "👎", "🤔"].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setPulseVote(e)}
            className="text-xl transition-transform hover:scale-125"
            style={{ opacity: pulseVote === e ? 1 : 0.5 }}
            data-ocid="games.trivia.toggle"
          >
            {e}
          </button>
        ))}
        {pulseVote && (
          <span className="text-xs text-[#a7b0c2]">
            Zorluk:{" "}
            {pulseVote === "👍" ? "Kolay" : pulseVote === "👎" ? "Zor" : "Orta"}
          </span>
        )}
      </div>

      {selected !== null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={next}
            className="flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              background: "rgba(168,85,255,0.15)",
              border: "1px solid rgba(168,85,255,0.4)",
              color: "#c084fc",
            }}
            data-ocid="games.trivia.secondary_button"
          >
            Sonraki Soru
          </button>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard
                .writeText(`PulseRide Trivia Skor: ${score} #PulseRide`)
                .then(() => toast.success("Skor kopyalandı! 🔗"))
            }
            className="px-4 py-2 rounded-full text-xs font-bold uppercase flex items-center gap-1"
            style={{
              background: "rgba(46,230,214,0.1)",
              border: "1px solid rgba(46,230,214,0.3)",
              color: "#2ee6d6",
            }}
            data-ocid="games.trivia.submit_button"
          >
            <Share2 className="w-3 h-3" /> SONUCU PAYLAŞ
          </button>
        </div>
      )}
    </div>
  );
}

function EmojiDuel({ voiceBooster }: { voiceBooster: VoiceBooster | null }) {
  const [round, setRound] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [result, setResult] = useState<{
    player: string;
    ai: string;
    winner: "player" | "ai" | "tie";
  } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [done, setDone] = useState(false);

  const pair = EMOJI_PAIRS[round % EMOJI_PAIRS.length];

  const pick = (emoji: string) => {
    if (result !== null) return;
    const aiPick = pair[Math.floor(Math.random() * 2)];
    const win = emoji !== aiPick ? "player" : "tie";
    const lose = emoji === aiPick ? "tie" : "ai";
    const winner = win === "player" ? "player" : lose === "ai" ? "ai" : "tie";
    setResult({ player: emoji, ai: aiPick, winner });
    if (winner === "player") setPlayerScore((s) => s + 1);
    else if (winner === "ai") setAiScore((s) => s + 1);
    if (winner === "player") {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 800);
    }
  };

  const nextRound = () => {
    if (round + 1 >= 3) {
      setDone(true);
      return;
    }
    setRound((r) => r + 1);
    setResult(null);
  };

  const reset = () => {
    setRound(0);
    setPlayerScore(0);
    setAiScore(0);
    setResult(null);
    setDone(false);
  };

  const hasVoiceBonus = !!voiceBooster;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(46,230,214,0.04)",
        border: "1px solid rgba(46,230,214,0.15)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          Pulse Emoji Düellosu
        </h3>
        <span className="text-xs text-[#a7b0c2]">{round + 1}/3</span>
      </div>

      <div className="flex items-center justify-between text-center mb-4">
        <div>
          <p className="text-xs text-[#a7b0c2] mb-1">SEN</p>
          <p className="text-2xl font-black text-white">{playerScore}</p>
        </div>
        <span className="text-lg text-[#a7b0c2]">VS</span>
        <div>
          <p className="text-xs text-[#a7b0c2] mb-1">AI</p>
          <p className="text-2xl font-black text-white">{aiScore}</p>
        </div>
      </div>

      {!done && (
        <>
          <p className="text-xs text-center text-[#a7b0c2] mb-3">Birini seç:</p>
          <div className="flex gap-4 justify-center mb-4">
            {pair.map((e) => (
              <motion.button
                key={e}
                type="button"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => pick(e)}
                className="text-4xl px-6 py-3 rounded-2xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                data-ocid="games.duel.button"
              >
                {e}
              </motion.button>
            ))}
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: celebrating ? 1.05 : 1 }}
              className="text-center mb-3"
            >
              <p
                className="text-sm mb-1"
                style={{
                  color:
                    result.winner === "player"
                      ? "#2ee6d6"
                      : result.winner === "ai"
                        ? "#f87171"
                        : "#a7b0c2",
                }}
              >
                {result.winner === "player"
                  ? "Kazandın! 🎉"
                  : result.winner === "ai"
                    ? "AI Kazandı 🤖"
                    : "Berabere!"}
                {result.winner === "player" && hasVoiceBonus && (
                  <span
                    className="ml-2 text-xs font-black"
                    style={{ color: "#2ee6d6" }}
                  >
                    +BONUS 🎙️
                  </span>
                )}
              </p>
              <p className="text-xs text-[#a7b0c2]">
                {result.player} vs {result.ai}
              </p>
              <button
                type="button"
                onClick={nextRound}
                className="mt-2 px-5 py-1.5 rounded-full text-xs font-bold uppercase"
                style={{
                  background: "rgba(168,85,255,0.15)",
                  border: "1px solid rgba(168,85,255,0.4)",
                  color: "#c084fc",
                }}
                data-ocid="games.duel.secondary_button"
              >
                Devam
              </button>
            </motion.div>
          )}
        </>
      )}

      {done && (
        <div className="text-center">
          <p className="text-lg font-black text-white mb-1">
            {playerScore > aiScore
              ? "KAZANDIN! 🏆"
              : playerScore < aiScore
                ? "AI Kazandı 🤖"
                : "Berabere!"}
          </p>
          <p className="text-xs text-[#a7b0c2] mb-4">
            {playerScore} – {aiScore}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 py-2 rounded-full text-xs font-bold uppercase"
              style={{
                background: "rgba(46,230,214,0.1)",
                border: "1px solid rgba(46,230,214,0.3)",
                color: "#2ee6d6",
              }}
              data-ocid="games.duel.secondary_button"
            >
              Tekrar
            </button>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  .writeText(
                    `PulseRide Emoji Düellosu: ${playerScore}-${aiScore} #PulseRide #ViralMod`,
                  )
                  .then(() => toast.success("Sonuç kopyalandı! 🔗"))
              }
              className="flex-1 py-2 rounded-full text-xs font-bold uppercase flex items-center justify-center gap-1"
              style={{
                background: "rgba(168,85,255,0.1)",
                border: "1px solid rgba(168,85,255,0.3)",
                color: "#c084fc",
              }}
              data-ocid="games.duel.submit_button"
            >
              <Share2 className="w-3 h-3" /> SONUCU PAYLAŞ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GamesTab() {
  const [voiceBooster, setVoiceBooster] = useState<VoiceBooster | null>(null);

  const handleBooster = useCallback((emoji: string, label: string) => {
    setVoiceBooster({ emoji, label });
  }, []);

  return (
    <div className="space-y-5">
      <PulseVoicePanel onBooster={handleBooster} />
      <ReactionGame voiceBooster={voiceBooster} />
      <TriviaGame voiceBooster={voiceBooster} />
      <EmojiDuel voiceBooster={voiceBooster} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// LEADERBOARD TAB
// ──────────────────────────────────────────────────────────
type LeaderboardPeriod = "week" | "month" | "all";

function LeaderboardTab() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");

  const data = useMemo(() => {
    const rand = seededRand(
      period === "week" ? 42 : period === "month" ? 77 : 13,
    );
    return Array.from({ length: 10 }, (_, i) => {
      const num = Math.floor(rand() * 9000 + 1000);
      const rides = Math.floor(rand() * 80 + 5);
      const pulse = Math.floor(rand() * 60 + 2);
      const phantom = Math.floor(rand() * 20);
      const score = rides * 10 + pulse * 5 + phantom * 15;
      return { id: `GHOST-${num}`, rides, pulse, phantom, score, rank: i + 1 };
    })
      .sort((a, b) => b.score - a.score)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [period]);

  const CURRENT_USER_RANK = 7;

  const rankStyle = (rank: number) => {
    if (rank === 1) return { color: "#fbbf24", icon: "🥇" };
    if (rank === 2) return { color: "#94a3b8", icon: "🥈" };
    if (rank === 3) return { color: "#b45309", icon: "🥉" };
    return { color: "#a7b0c2", icon: `#${rank}` };
  };

  return (
    <div>
      {/* Period sub-tabs */}
      <div className="flex gap-2 mb-5">
        {(["week", "month", "all"] as LeaderboardPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className="flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background:
                period === p
                  ? "rgba(46,230,214,0.15)"
                  : "rgba(255,255,255,0.04)",
              border: `1px solid ${period === p ? "rgba(46,230,214,0.5)" : "rgba(255,255,255,0.08)"}`,
              color: period === p ? "#2ee6d6" : "#a7b0c2",
            }}
            data-ocid="leaderboard.tab"
          >
            {p === "week"
              ? "BU HAFTA"
              : p === "month"
                ? "BU AY"
                : "TÜM ZAMANLAR"}
          </button>
        ))}
      </div>

      <div className="space-y-2 mb-5">
        {data.map((entry, i) => {
          const rs = rankStyle(entry.rank);
          const isMe = entry.rank === CURRENT_USER_RANK;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: isMe
                  ? "rgba(46,230,214,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${isMe ? "rgba(46,230,214,0.35)" : "rgba(255,255,255,0.06)"}`,
                boxShadow: isMe ? "0 0 16px rgba(46,230,214,0.1)" : "none",
              }}
              data-ocid={`leaderboard.item.${i + 1}`}
            >
              <span
                className="text-sm font-black w-8 text-center"
                style={{ color: rs.color }}
              >
                {rs.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    {entry.id}
                  </span>
                  {isMe && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: "rgba(46,230,214,0.2)",
                        color: "#2ee6d6",
                        border: "1px solid rgba(46,230,214,0.4)",
                      }}
                    >
                      SEN
                    </span>
                  )}
                </div>
                <Progress
                  value={(entry.score / 1200) * 100}
                  className="h-1 mt-1.5"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div className="flex items-center gap-1 text-sm">
                {entry.rides > 20 && <span title="Ride Count">🏆</span>}
                {entry.pulse > 30 && <span title="Pulse Activity">⚡</span>}
                {entry.phantom > 8 && <span title="Phantom Rides">👻</span>}
              </div>
              <span className="text-xs font-black" style={{ color: "#a855ff" }}>
                {entry.score}
              </span>
            </motion.div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          navigator.clipboard
            .writeText(
              `PulseRide Sıram: #${CURRENT_USER_RANK} 🏆 #PulseRide #ViralMod`,
            )
            .then(() => toast.success("Sıralama kopyalandı! 🔗"))
        }
        className="w-full py-3 rounded-full font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2"
        style={{
          background:
            "linear-gradient(135deg, rgba(168,85,255,0.2), rgba(46,230,214,0.15))",
          border: "1px solid rgba(168,85,255,0.4)",
          color: "#e9d5ff",
        }}
        data-ocid="leaderboard.share.button"
      >
        <Trophy className="w-4 h-4" /> SIRALAMANI PAYLAŞ
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CHALLENGES TAB
// ──────────────────────────────────────────────────────────
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function ChallengesTab() {
  const countdown = useCountdown(23 * 3600 + 45 * 60 + 12);
  const [groupCode] = useState(() => {
    const seg = () => Math.random().toString(36).toUpperCase().slice(2, 6);
    return `VIRAL-${seg()}-${seg()}`;
  });

  const challenges = [
    {
      title: "Phantom Ride Challenge",
      desc: "5 Phantom Ride tamamla",
      progress: 2,
      total: 5,
      btnLabel: "ARKADAŞINI DAVET ET",
      icon: "👻",
      color: "#a855ff",
    },
    {
      title: "Pulse Sync Challenge",
      desc: "10 sürüşte Pulse gönder",
      progress: 6,
      total: 10,
      btnLabel: "MEYDAN OKU",
      icon: "⚡",
      color: "#2ee6d6",
    },
    {
      title: "Speed Round",
      desc: "3 sürüşü 48 saatte tamamla",
      progress: 1,
      total: 3,
      btnLabel: "GRUBU OLUŞTUR",
      icon: "🏎️",
      color: "#f59e0b",
      countdown: true,
    },
  ];

  return (
    <div className="space-y-5">
      {challenges.map((ch, i) => (
        <motion.div
          key={ch.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl p-5"
          style={{
            background: `${ch.color}0d`,
            border: `1px solid ${ch.color}33`,
          }}
          data-ocid={`challenges.item.${i + 1}`}
        >
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{ch.icon}</span>
            <div className="flex-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-white mb-0.5">
                {ch.title}
              </h3>
              <p className="text-xs text-[#a7b0c2]">{ch.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => copyLink(ch.title)}
              className="p-1.5 rounded-lg"
              style={{ background: `${ch.color}15`, color: ch.color }}
              data-ocid={`challenges.share.button.${i + 1}`}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: ch.color }}>
              {ch.progress}/{ch.total}
            </span>
            {ch.countdown && (
              <span className="font-mono" style={{ color: ch.color }}>
                ⏱ {countdown}
              </span>
            )}
          </div>
          <Progress
            value={(ch.progress / ch.total) * 100}
            className="h-1.5 mb-4"
            style={{ background: `${ch.color}20` }}
          />

          <button
            type="button"
            onClick={() => copyLink(`${ch.title}-challenge`)}
            className="w-full py-2.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              background: `${ch.color}22`,
              border: `1px solid ${ch.color}55`,
              color: ch.color,
            }}
            data-ocid={`challenges.item.${i + 1}.button`}
          >
            {ch.btnLabel}
          </button>
        </motion.div>
      ))}

      {/* Group Ride Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(168,85,255,0.08), rgba(46,230,214,0.06))",
          border: "1px solid rgba(168,85,255,0.3)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5" style={{ color: "#2ee6d6" }} />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            GRUP SÜRÜŞÜ OLUŞTUR
          </h3>
        </div>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="flex-1 text-sm font-mono font-bold"
            style={{ color: "#2ee6d6" }}
          >
            {groupCode}
          </span>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard
                .writeText(groupCode)
                .then(() => toast.success("Grup kodu kopyalandı! 🔗"))
            }
            className="p-1.5 rounded-lg"
            style={{ background: "rgba(46,230,214,0.15)", color: "#2ee6d6" }}
            data-ocid="challenges.group_code.button"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#a7b0c2]">
          Geçici kod — oturum sonunda silinir 🔒
        </p>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────
export default function ViralModePage({ onBack }: ViralModePageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("snapshots");

  const tabContent: Record<Tab, React.ReactNode> = {
    snapshots: <SnapshotsTab />,
    phantom: <PhantomTab />,
    games: <GamesTab />,
    leaderboard: <LeaderboardTab />,
    challenges: <ChallengesTab />,
  };

  return (
    <div className="min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-full transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#a7b0c2",
            }}
            data-ocid="viral.back.button"
          >
            <ChevronLeft className="w-4 h-4" /> GERİ
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
                className="text-2xl"
              >
                🔥
              </motion.div>
              <h1
                className="text-2xl md:text-3xl font-black uppercase tracking-widest"
                style={{
                  background: "linear-gradient(135deg, #a855ff, #2ee6d6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                VIRAL MOD
              </h1>
              <div
                className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{
                  background: "rgba(168,85,255,0.15)",
                  border: "1px solid rgba(168,85,255,0.4)",
                  color: "#c084fc",
                }}
              >
                <Zap className="w-3 h-3" /> BETA
              </div>
            </div>
            <p className="text-xs text-[#a7b0c2] mt-0.5">
              Anonim paylaş • Rekabet et • Viral ol
            </p>
          </div>

          <div
            className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(46,230,214,0.08)",
              border: "1px solid rgba(46,230,214,0.2)",
              color: "#2ee6d6",
            }}
          >
            <Award className="w-3.5 h-3.5" /> Tüm içerik anonim
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                background:
                  activeTab === tab.id
                    ? "linear-gradient(135deg, rgba(168,85,255,0.3), rgba(46,230,214,0.2))"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  activeTab === tab.id
                    ? "rgba(168,85,255,0.5)"
                    : "rgba(255,255,255,0.08)"
                }`,
                color: activeTab === tab.id ? "#e9d5ff" : "#a7b0c2",
                boxShadow:
                  activeTab === tab.id
                    ? "0 0 12px rgba(168,85,255,0.2)"
                    : "none",
              }}
              data-ocid={`viral.${tab.id}.tab`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {tabContent[activeTab]}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <footer className="text-center pt-6 pb-2">
          <p className="text-xs text-[#a7b0c2]/50">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#2ee6d6] transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
