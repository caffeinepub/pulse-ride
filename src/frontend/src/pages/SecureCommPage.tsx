import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Copy,
  Link,
  Mic,
  MicOff,
  Skull,
  Unplug,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SecureCommPageProps {
  onBack: () => void;
}

type VoiceStyle = "MALE" | "FEMALE" | "NEUTRAL" | "SYNTHETIC";
type Emotion = "CALM" | "SERIOUS" | "ENERGETIC";
type OutputMode = "VOICE ONLY" | "TEXT ONLY" | "BOTH";
type TargetLang = "EN" | "TR" | "ES" | "FR" | "DE" | "ZH" | "AR" | "RU" | "JA";

type P2PState = "idle" | "waiting" | "connected" | "disconnected";

interface SubtitleEntry {
  id: number;
  timestamp: string;
  original: string;
  translated: string;
}

interface RemoteMessage {
  id: number;
  ghostId: string;
  text: string;
  displayText: string;
  timestamp: string;
}

const MOCK_PHRASES = [
  "Secure channel established. Transmitting encrypted payload.",
  "Identity mask active. Voice signature neutralized.",
  "Route obfuscation layer engaged. Coordinates randomized.",
  "Phantom node relay confirmed. Zero trace protocol online.",
  "Biometric scrub complete. Signal clean.",
  "Ghost protocol initiated. All patterns removed.",
];

const REMOTE_PHRASES = [
  "Ghost signal received. Encryption layer confirmed.",
  "Phantom route active. Zero trace protocol engaged.",
  "Identity mask applied. Voice signature scrubbed.",
  "Biometric data removed. Channel clean.",
  "Secure handshake complete. Transmission encrypted.",
  "AI voice synthesis active. Original patterns erased.",
];

function translate(lang: TargetLang, s: string): string {
  switch (lang) {
    case "EN":
      return s;
    case "TR":
      return `[TR] ${s
        .replace(/Secure/g, "G\u00fcvenli")
        .replace(/channel/g, "kanal")
        .replace(/encrypted/g, "\u015fifreli")}`;
    case "ES":
      return `[ES] ${s
        .replace(/Secure/g, "Seguro")
        .replace(/channel/g, "canal")
        .replace(/encrypted/g, "cifrado")}`;
    case "FR":
      return `[FR] ${s
        .replace(/Secure/g, "S\u00e9curis\u00e9")
        .replace(/channel/g, "canal")
        .replace(/encrypted/g, "chiffr\u00e9")}`;
    case "DE":
      return `[DE] ${s
        .replace(/Secure/g, "Sicher")
        .replace(/channel/g, "Kanal")
        .replace(/encrypted/g, "verschl\u00fcsselt")}`;
    case "ZH":
      return "[ZH] \u5b89\u5168\u9891\u9053\u5df2\u5efa\u7acb\u3002\u6b63\u5728\u4f20\u8f93\u52a0\u5bc6\u6570\u636e\u5305\u3002";
    case "AR":
      return "[AR] \u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0646\u0627\u0629 \u0627\u0644\u0622\u0645\u0646\u0629. \u062c\u0627\u0631\u064d \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062d\u0645\u0648\u0644\u0629 \u0627\u0644\u0645\u0634\u0641\u0631\u0629.";
    case "RU":
      return "[RU] \u0417\u0430\u0449\u0438\u0449\u0451\u043d\u043d\u044b\u0439 \u043a\u0430\u043d\u0430\u043b \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d. \u041f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0437\u0430\u0448\u0438\u0444\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445.";
    case "JA":
      return "[JA] \u30bb\u30ad\u30e5\u30a2\u30c1\u30e3\u30f3\u30cd\u30eb\u304c\u78ba\u7acb\u3055\u308c\u307e\u3057\u305f\u3002\u6697\u53f7\u5316\u30da\u30a4\u30ed\u30fc\u30c9\u3092\u9001\u4fe1\u4e2d\u3002";
    default:
      return s;
  }
}

function generateGhostId() {
  return `GHOST-${Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0")}`;
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function getNow() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// --- P2P Ghost Channel Component ---
function P2PGhostChannel({
  localId,
  analyserRef,
  isRecording,
}: {
  localId: string;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isRecording: boolean;
}) {
  const [p2pState, setP2pState] = useState<P2PState>("idle");
  const [generatedCode, setGeneratedCode] = useState("");
  const [enterCodeInput, setEnterCodeInput] = useState("");
  const [showEnterInput, setShowEnterInput] = useState(false);
  const [remoteId] = useState(generateGhostId);
  const [remoteMessages, setRemoteMessages] = useState<RemoteMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const [manualWaiting, setManualWaiting] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualElapsed, setManualElapsed] = useState(0);
  const [manualTimedOut, setManualTimedOut] = useState(false);

  const localWaveRef = useRef<HTMLCanvasElement>(null);
  const remoteWaveRef = useRef<HTMLCanvasElement>(null);
  const localRafRef = useRef<number>(0);
  const remoteRafRef = useRef<number>(0);
  const remoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remotePhraseIdx = useRef(0);
  const remoteIdRef = useRef(0);
  const typewriterTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const manualPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate dots
  useEffect(() => {
    if (p2pState !== "waiting") return;
    const t = setInterval(() => setDotCount((d) => (d % 3) + 1), 500);
    return () => clearInterval(t);
  }, [p2pState]);

  // Manual code polling
  useEffect(() => {
    if (!manualWaiting || !manualCode) return;
    const localUserId = "local"; // stable per component instance
    const key = `p2p_shared_${manualCode}`;
    // Register presence
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ user: localUserId, ts: Date.now() }),
      );
    } catch {}

    manualPollRef.current = setInterval(() => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.user !== localUserId) {
          // Another user is waiting — connect!
          localStorage.removeItem(key);
          clearInterval(manualPollRef.current!);
          clearTimeout(manualTimeoutRef.current!);
          clearInterval(manualElapsedRef.current!);
          setManualWaiting(false);
          handleConnect();
        }
      } catch {}
    }, 800);

    manualElapsedRef.current = setInterval(() => {
      setManualElapsed((e) => e + 1);
    }, 1000);

    manualTimeoutRef.current = setTimeout(() => {
      clearInterval(manualPollRef.current!);
      clearInterval(manualElapsedRef.current!);
      try {
        localStorage.removeItem(key);
      } catch {}
      setManualWaiting(false);
      setManualTimedOut(true);
      setTimeout(() => setManualTimedOut(false), 4000);
    }, 120000);

    return () => {
      clearInterval(manualPollRef.current!);
      clearTimeout(manualTimeoutRef.current!);
      clearInterval(manualElapsedRef.current!);
      try {
        localStorage.removeItem(key);
      } catch {}
    };
  }, [manualWaiting, manualCode]);

  // Auto return from disconnected
  useEffect(() => {
    if (p2pState !== "disconnected") return;
    const t = setTimeout(() => setP2pState("idle"), 2000);
    return () => clearTimeout(t);
  }, [p2pState]);

  // Local waveform (mirrors main analyser when recording)
  const drawLocalWave = useCallback(() => {
    const canvas = localWaveRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#060812";
    ctx.fillRect(0, 0, width, height);

    const analyser = analyserRef.current;
    if (analyser && isRecording) {
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,0,80,0.9)";
      ctx.lineWidth = 1.5;
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    } else {
      // idle sine
      const t = Date.now() / 800;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,0,80,0.3)";
      ctx.lineWidth = 1.5;
      for (let x2 = 0; x2 < width; x2++) {
        const y = height / 2 + Math.sin(x2 * 0.06 + t) * 6;
        if (x2 === 0) ctx.moveTo(x2, y);
        else ctx.lineTo(x2, y);
      }
      ctx.stroke();
    }
    localRafRef.current = requestAnimationFrame(drawLocalWave);
  }, [analyserRef, isRecording]);

  // Remote waveform (simulated cyan sine)
  const drawRemoteWave = useCallback(() => {
    const canvas = remoteWaveRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#060812";
    ctx.fillRect(0, 0, width, height);
    const t = Date.now() / 600;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,245,255,0.8)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x++) {
      const y =
        height / 2 +
        Math.sin(x * 0.05 + t) * 10 +
        Math.sin(x * 0.03 + t * 1.4) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    remoteRafRef.current = requestAnimationFrame(drawRemoteWave);
  }, []);

  // Start/stop waveform animations and remote feed
  useEffect(() => {
    if (p2pState === "connected") {
      localRafRef.current = requestAnimationFrame(drawLocalWave);
      remoteRafRef.current = requestAnimationFrame(drawRemoteWave);

      // Typewriter helper
      const typewrite = (full: string, msgId: number) => {
        let i = 0;
        const tick = () => {
          i++;
          setRemoteMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, displayText: full.slice(0, i) } : m,
            ),
          );
          if (i < full.length) {
            const t = setTimeout(tick, 28);
            typewriterTimers.current.push(t);
          }
        };
        const t = setTimeout(tick, 28);
        typewriterTimers.current.push(t);
      };

      remoteTimerRef.current = setInterval(() => {
        const phrase =
          REMOTE_PHRASES[remotePhraseIdx.current % REMOTE_PHRASES.length];
        remotePhraseIdx.current++;
        const msgId = ++remoteIdRef.current;
        setRemoteMessages((prev) => [
          ...prev.slice(-19),
          {
            id: msgId,
            ghostId: remoteId,
            text: phrase,
            displayText: "",
            timestamp: getNow(),
          },
        ]);
        typewrite(phrase, msgId);
      }, 3500);

      return () => {
        cancelAnimationFrame(localRafRef.current);
        cancelAnimationFrame(remoteRafRef.current);
        if (remoteTimerRef.current) clearInterval(remoteTimerRef.current);
        for (const t of typewriterTimers.current) clearTimeout(t);
        typewriterTimers.current = [];
      };
    }
  }, [p2pState, drawLocalWave, drawRemoteWave, remoteId]);

  const cancelManual = () => {
    clearInterval(manualPollRef.current!);
    clearTimeout(manualTimeoutRef.current!);
    clearInterval(manualElapsedRef.current!);
    try {
      if (manualCode) localStorage.removeItem(`p2p_shared_${manualCode}`);
    } catch {}
    setManualWaiting(false);
    setManualElapsed(0);
  };

  const handleManualWait = () => {
    if (manualInput.trim().length < 2) return;
    const code = manualInput.trim().toUpperCase();
    setManualCode(code);
    setManualElapsed(0);
    setManualTimedOut(false);
    setManualWaiting(true);
  };

  const handleGenerate = () => {
    const code = generateGhostId();
    setGeneratedCode(code);
    setCopied(false);
    setP2pState("waiting");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    setRemoteMessages([]);
    remotePhraseIdx.current = 0;
    remoteIdRef.current = 0;
    setManualWaiting(false);
    setShowManualInput(false);
    setP2pState("connected");
  };

  const handleDisconnect = () => {
    cancelAnimationFrame(localRafRef.current);
    cancelAnimationFrame(remoteRafRef.current);
    if (remoteTimerRef.current) clearInterval(remoteTimerRef.current);
    for (const t of typewriterTimers.current) clearTimeout(t);
    typewriterTimers.current = [];
    setRemoteMessages([]);
    setShowEnterInput(false);
    setEnterCodeInput("");
    setP2pState("disconnected");
  };

  return (
    <div
      className="rounded-xl border space-y-0 overflow-hidden"
      style={{
        background: "#0a0f1e",
        border: "1px solid rgba(0,245,255,0.25)",
        boxShadow:
          "0 0 30px rgba(0,245,255,0.08), inset 0 0 30px rgba(0,0,0,0.3)",
      }}
      data-ocid="p2p.panel"
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(0,245,255,0.15)",
          background: "rgba(0,245,255,0.04)",
        }}
      >
        <div className="flex items-center gap-2">
          <Wifi
            className="w-3.5 h-3.5"
            style={{ color: p2pState === "connected" ? "#00f5ff" : "#4a5568" }}
          />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
            P2P GHOST CHANNEL
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{
            background:
              p2pState === "connected"
                ? "rgba(16,185,129,0.12)"
                : p2pState === "waiting"
                  ? "rgba(255,193,7,0.12)"
                  : p2pState === "disconnected"
                    ? "rgba(255,0,80,0.12)"
                    : "rgba(255,255,255,0.05)",
            border:
              p2pState === "connected"
                ? "1px solid rgba(16,185,129,0.4)"
                : p2pState === "waiting"
                  ? "1px solid rgba(255,193,7,0.4)"
                  : p2pState === "disconnected"
                    ? "1px solid rgba(255,0,80,0.4)"
                    : "1px solid rgba(255,255,255,0.1)",
            color:
              p2pState === "connected"
                ? "#10b981"
                : p2pState === "waiting"
                  ? "#ffc107"
                  : p2pState === "disconnected"
                    ? "#ff0050"
                    : "#4a5568",
          }}
        >
          {p2pState === "connected" && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          )}
          {p2pState.toUpperCase()}
        </div>
      </div>

      {/* Panel body */}
      <div className="p-4">
        {/* IDLE */}
        {p2pState === "idle" && (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 font-mono text-center uppercase tracking-wider">
              Establish an encrypted peer-to-peer ghost link
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: "rgba(0,245,255,0.08)",
                  border: "1px solid rgba(0,245,255,0.4)",
                  color: "#00f5ff",
                  boxShadow: "0 0 12px rgba(0,245,255,0.2)",
                }}
                data-ocid="p2p.generate_link.button"
              >
                <Link className="w-3.5 h-3.5" />
                GENERATE LINK CODE
              </button>
              <button
                type="button"
                onClick={() => setShowEnterInput((v) => !v)}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: showEnterInput
                    ? "rgba(139,92,246,0.15)"
                    : "rgba(139,92,246,0.06)",
                  border: showEnterInput
                    ? "1px solid rgba(139,92,246,0.7)"
                    : "1px solid rgba(139,92,246,0.3)",
                  color: "#8b5cf6",
                  boxShadow: showEnterInput
                    ? "0 0 12px rgba(139,92,246,0.3)"
                    : "none",
                }}
                data-ocid="p2p.enter_code.button"
              >
                <Unplug className="w-3.5 h-3.5" />
                ENTER CODE
              </button>
            </div>
            {showEnterInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={enterCodeInput}
                  onChange={(e) =>
                    setEnterCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="GHOST-XXXX"
                  className="flex-1 bg-transparent font-mono text-xs text-cyan-300 placeholder:text-gray-600 px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(0,245,255,0.25)",
                  }}
                  data-ocid="p2p.code.input"
                />
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={enterCodeInput.length < 5}
                  className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(0,245,255,0.12)",
                    border: "1px solid rgba(0,245,255,0.5)",
                    color: "#00f5ff",
                  }}
                  data-ocid="p2p.connect.button"
                >
                  CONNECT
                </button>
              </div>
            )}

            {/* MANUEL KOD button */}
            <button
              type="button"
              onClick={() => {
                setShowManualInput((v) => !v);
                setShowEnterInput(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: showManualInput
                  ? "rgba(251,146,60,0.15)"
                  : "rgba(251,146,60,0.06)",
                border: showManualInput
                  ? "1px solid rgba(251,146,60,0.7)"
                  : "1px solid rgba(251,146,60,0.3)",
                color: "#fb923c",
                boxShadow: showManualInput
                  ? "0 0 12px rgba(251,146,60,0.3)"
                  : "none",
              }}
              data-ocid="p2p.manual_code.button"
            >
              🔑 MANUEL KOD — PAYLAŞILAN KOD İLE BAĞLAN
            </button>
            {showManualInput && (
              <div className="space-y-2">
                <p className="text-[9px] text-orange-400/70 font-mono text-center">
                  Aynı kodu iki kullanıcı girince otomatik bağlanır • Aynı
                  cihazda veya aynı ağda çalışır
                </p>
                {manualTimedOut && (
                  <p className="text-[10px] text-red-400 font-mono text-center animate-pulse">
                    ⏱ Bağlantı zaman aşımına uğradı (120s)
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="GECE-2024, KANAL-X..."
                    className="flex-1 bg-transparent font-mono text-xs text-orange-300 placeholder:text-gray-600 px-3 py-2 rounded-lg outline-none"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(251,146,60,0.35)",
                    }}
                    data-ocid="p2p.manual_code.input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualWait();
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleManualWait}
                    disabled={manualInput.trim().length < 2}
                    className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                    style={{
                      background: "rgba(251,146,60,0.15)",
                      border: "1px solid rgba(251,146,60,0.6)",
                      color: "#fb923c",
                    }}
                    data-ocid="p2p.manual_wait.button"
                  >
                    BEKLE
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MANUAL WAITING */}
        {manualWaiting && (
          <div className="space-y-4">
            <div
              className="text-center py-5 rounded-xl"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(251,146,60,0.5)",
                boxShadow:
                  "0 0 24px rgba(251,146,60,0.2), inset 0 0 20px rgba(251,146,60,0.05)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              <p className="font-mono text-[9px] text-orange-400/70 uppercase tracking-widest mb-2">
                PAYLAŞILAN KOD
              </p>
              <p
                className="font-mono text-2xl font-black tracking-widest mb-1"
                style={{
                  color: "#fb923c",
                  textShadow: "0 0 20px rgba(251,146,60,0.8)",
                }}
              >
                {manualCode}
              </p>
              <p className="font-mono text-[10px] text-orange-300/60">
                Partner bekleniyor{".".repeat(dotCount)}
              </p>
              <p className="font-mono text-[9px] text-gray-600 mt-1">
                {manualElapsed}s / 120s
              </p>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{
                background: "rgba(251,146,60,0.1)",
                border: "1px solid rgba(251,146,60,0.2)",
              }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(manualElapsed / 120) * 100}%`,
                  background: "linear-gradient(90deg, #fb923c, #f97316)",
                  boxShadow: "0 0 8px rgba(251,146,60,0.5)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={cancelManual}
              className="w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: "rgba(251,146,60,0.08)",
                border: "1px solid rgba(251,146,60,0.3)",
                color: "#fb923c80",
              }}
              data-ocid="p2p.manual_cancel.button"
            >
              İPTAL
            </button>
          </div>
        )}

        {/* WAITING */}
        {p2pState === "waiting" && (
          <div className="space-y-4">
            <div
              className="text-center py-4 rounded-xl"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(0,245,255,0.4)",
                boxShadow:
                  "0 0 20px rgba(0,245,255,0.15), inset 0 0 20px rgba(0,245,255,0.05)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                LINK CODE
              </p>
              <p
                className="font-mono text-2xl font-black tracking-[0.15em]"
                style={{
                  color: "#00f5ff",
                  textShadow: "0 0 20px rgba(0,245,255,0.8)",
                }}
              >
                {generatedCode}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: copied
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(0,245,255,0.06)",
                border: copied
                  ? "1px solid rgba(16,185,129,0.5)"
                  : "1px solid rgba(0,245,255,0.2)",
                color: copied ? "#10b981" : "#00f5ff",
              }}
              data-ocid="p2p.copy_code.button"
            >
              <Copy className="w-3 h-3" />
              {copied ? "COPIED TO CLIPBOARD" : "COPY CODE"}
            </button>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest"
                  style={{ textShadow: "0 0 8px rgba(255,193,7,0.6)" }}
                >
                  AWAITING PARTNER{".".repeat(dotCount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setP2pState("idle");
                  setShowEnterInput(false);
                }}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: "rgba(255,0,80,0.08)",
                  border: "1px solid rgba(255,0,80,0.3)",
                  color: "rgba(255,0,80,0.8)",
                }}
                data-ocid="p2p.cancel.button"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* CONNECTED */}
        {p2pState === "connected" && (
          <div className="space-y-3">
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(0,245,255,0.2)",
              }}
            >
              <span style={{ color: "rgba(255,0,80,0.9)" }}>{localId}</span>
              <span className="text-gray-500">←→</span>
              <span style={{ color: "#00f5ff" }}>{remoteId}</span>
            </div>

            {/* Dual waveforms */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p
                  className="text-[9px] font-mono uppercase tracking-widest text-center"
                  style={{ color: "rgba(255,0,80,0.7)" }}
                >
                  YOU (LOCAL)
                </p>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: "#060812",
                    border: "1px solid rgba(255,0,80,0.25)",
                  }}
                >
                  <canvas
                    ref={localWaveRef}
                    width={200}
                    height={50}
                    className="w-full h-[44px]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p
                  className="text-[9px] font-mono uppercase tracking-widest text-center"
                  style={{ color: "rgba(0,245,255,0.7)" }}
                >
                  REMOTE
                </p>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: "#060812",
                    border: "1px solid rgba(0,245,255,0.25)",
                  }}
                >
                  <canvas
                    ref={remoteWaveRef}
                    width={200}
                    height={50}
                    className="w-full h-[44px]"
                  />
                </div>
              </div>
            </div>

            {/* Remote channel feed */}
            <div
              className="rounded-lg"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(0,245,255,0.15)",
              }}
            >
              <div
                className="px-3 py-1.5 border-b flex items-center gap-2"
                style={{ borderColor: "rgba(0,245,255,0.1)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-500">
                  REMOTE CHANNEL
                </span>
              </div>
              <ScrollArea className="h-32">
                <div className="px-3 py-2 space-y-2">
                  {remoteMessages.length === 0 ? (
                    <p className="text-[10px] font-mono text-gray-600 italic">
                      Awaiting remote transmission...
                    </p>
                  ) : (
                    remoteMessages.map((msg) => (
                      <div key={msg.id} className="flex gap-2">
                        <span className="font-mono text-[9px] text-gray-600 shrink-0 mt-0.5">
                          {msg.timestamp}
                        </span>
                        <div>
                          <span
                            className="font-mono text-[9px] font-bold"
                            style={{ color: "rgba(0,245,255,0.6)" }}
                          >
                            {msg.ghostId}:{" "}
                          </span>
                          <span className="font-mono text-[10px] text-gray-300">
                            {msg.displayText}
                          </span>
                          <span className="animate-pulse text-cyan-400">▌</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Disconnect */}
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: "rgba(255,0,80,0.08)",
                border: "1px solid rgba(255,0,80,0.4)",
                color: "rgba(255,0,80,0.9)",
                boxShadow: "0 0 10px rgba(255,0,80,0.15)",
              }}
              data-ocid="p2p.disconnect.button"
            >
              <Unplug className="w-3.5 h-3.5" />
              DISCONNECT + WIPE
            </button>
          </div>
        )}

        {/* DISCONNECTED */}
        {p2pState === "disconnected" && (
          <div
            className="text-center py-6 rounded-xl"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(139,92,246,0.4)",
              boxShadow: "0 0 20px rgba(255,0,80,0.15)",
            }}
          >
            <p
              className="font-mono text-xs font-black uppercase tracking-widest animate-pulse"
              style={{
                color: "#ff0050",
                textShadow: "0 0 15px rgba(255,0,80,0.8)",
              }}
            >
              CONNECTION TERMINATED
            </p>
            <p
              className="font-mono text-[10px] uppercase tracking-widest mt-1"
              style={{
                color: "rgba(139,92,246,0.9)",
                textShadow: "0 0 10px rgba(139,92,246,0.6)",
              }}
            >
              — ALL DATA WIPED —
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SecureCommPage({ onBack }: SecureCommPageProps) {
  const [sessionId] = useState(generateGhostId);
  const [sessionSecs, setSessionSecs] = useState(0);
  const [maskStrength] = useState(() => Math.floor(Math.random() * 24 + 73));
  const [simLatency, setSimLatency] = useState(480);

  const [isRecording, setIsRecording] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("NEUTRAL");
  const [emotion, setEmotion] = useState<Emotion>("CALM");
  const [outputMode, setOutputMode] = useState<OutputMode>("BOTH");
  const [targetLang, setTargetLang] = useState<TargetLang>("EN");
  const [ghostMode, setGhostMode] = useState(false);
  const [detectedLang, setDetectedLang] = useState("AUTO");
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<number>(-1);
  const [translationBox, setTranslationBox] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockPhraseIdx = useRef(0);
  const recognitionRef = useRef<any>(null);
  const subtitleIdRef = useRef(0);

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setSessionSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#060812";
    ctx.fillRect(0, 0, width, height);
    const t = Date.now() / 800;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,245,255,0.3)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x++) {
      const y =
        height / 2 +
        Math.sin(x * 0.04 + t) * 8 +
        Math.sin(x * 0.02 + t * 1.3) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    rafRef.current = requestAnimationFrame(drawIdle);
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#060812";
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,0,80,0.9)";
    ctx.lineWidth = 2;
    const sliceWidth = width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    rafRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawIdle);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawIdle]);

  const makeDistortionCurve = (amount: number) => {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  };

  const addSubtitle = useCallback(
    (original: string) => {
      const translated = translate(targetLang, original);
      setTranslationBox(translated);
      const entry: SubtitleEntry = {
        id: ++subtitleIdRef.current,
        timestamp: getNow(),
        original,
        translated,
      };
      setSubtitles((prev) => [...prev.slice(-19), entry]);
    },
    [targetLang],
  );

  const runPipeline = useCallback(
    (phrase: string) => {
      setProcessing(true);
      setSimLatency(Math.floor(Math.random() * 270 + 380));
      let stage = 0;
      const advance = () => {
        setPipelineStage(stage);
        stage++;
        if (stage < 4) setTimeout(advance, 140);
        else {
          setTimeout(() => {
            setProcessing(false);
            setPipelineStage(-1);
          }, 200);
        }
      };
      advance();
      addSubtitle(phrase);
    },
    [addSubtitle],
  );

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawIdle);
    setIsRecording(false);
  }, [drawIdle]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      const filter = audioCtx.createBiquadFilter();
      if (voiceStyle === "MALE") {
        filter.type = "lowshelf";
        filter.frequency.value = 80;
        filter.gain.value = 12;
      } else if (voiceStyle === "FEMALE") {
        filter.type = "highshelf";
        filter.frequency.value = 3000;
        filter.gain.value = 10;
      } else {
        filter.type = "allpass";
      }

      const shaper = audioCtx.createWaveShaper();
      if (voiceStyle === "SYNTHETIC" || ghostMode) {
        shaper.curve = makeDistortionCurve(
          voiceStyle === "SYNTHETIC" ? 400 : 200,
        );
        shaper.oversample = "4x";
      }

      source.connect(filter);
      filter.connect(shaper);
      shaper.connect(analyser);

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawWaveform);

      const w = window as any;
      const SRConstructor = w.SpeechRecognition || w.webkitSpeechRecognition;

      if (SRConstructor) {
        const recognition = new SRConstructor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (e: any) => {
          const transcript =
            e.results[e.results.length - 1][0].transcript.trim();
          if (transcript) {
            setDetectedLang(
              recognition.lang?.split("-")[0]?.toUpperCase() ?? "AUTO",
            );
            runPipeline(transcript);
          }
        };
        recognition.start();
        recognitionRef.current = recognition;
      } else {
        mockTimerRef.current = setInterval(() => {
          const phrase =
            MOCK_PHRASES[mockPhraseIdx.current % MOCK_PHRASES.length];
          mockPhraseIdx.current++;
          runPipeline(phrase);
        }, 3500);
      }

      setIsRecording(true);
    } catch {
      mockTimerRef.current = setInterval(() => {
        const phrase =
          MOCK_PHRASES[mockPhraseIdx.current % MOCK_PHRASES.length];
        mockPhraseIdx.current++;
        runPipeline(phrase);
      }, 3500);
      setIsRecording(true);
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
      cancelAnimationFrame(rafRef.current);
    };
  }, [stopRecording]);

  const PIPELINE_STAGES = ["CAPTURE", "MASK", "TRANSLATE", "OUTPUT"];
  const VOICE_STYLES: VoiceStyle[] = ["MALE", "FEMALE", "NEUTRAL", "SYNTHETIC"];
  const EMOTIONS: Emotion[] = ["CALM", "SERIOUS", "ENERGETIC"];
  const OUTPUT_MODES: OutputMode[] = ["VOICE ONLY", "TEXT ONLY", "BOTH"];
  const LANGS: TargetLang[] = [
    "EN",
    "TR",
    "ES",
    "FR",
    "DE",
    "ZH",
    "AR",
    "RU",
    "JA",
  ];

  const showSubtitles = outputMode === "TEXT ONLY" || outputMode === "BOTH";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060812] to-[#0a0f1e] text-white pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-cyan-500/20 bg-[#060812]/90 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg border border-white/10 hover:border-cyan-500/40 transition-colors"
          data-ocid="secure_comm.back.button"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">
            GHOST COMM
          </h1>
          <span className="font-mono text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded">
            {sessionId}
          </span>
        </div>
        <div className="font-mono text-xs text-white/60">
          {formatTime(sessionSecs)}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] uppercase tracking-wider text-green-400 font-bold">
            EPHEMERAL
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Waveform Visualizer */}
        <div
          className="rounded-xl overflow-hidden border border-cyan-500/20"
          style={{ background: "#060812" }}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={100}
            className="w-full h-[80px]"
          />
        </div>

        {/* P2P Ghost Channel */}
        <P2PGhostChannel
          localId={sessionId}
          analyserRef={analyserRef}
          isRecording={isRecording}
        />

        {/* Mic Button */}
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: isRecording
                ? "radial-gradient(circle, rgba(255,0,80,0.3), rgba(255,0,80,0.1))"
                : "radial-gradient(circle, rgba(0,245,255,0.15), rgba(0,245,255,0.05))",
              border: isRecording
                ? "2px solid rgba(255,0,80,0.8)"
                : "2px solid rgba(0,245,255,0.4)",
              boxShadow: isRecording
                ? "0 0 30px rgba(255,0,80,0.6), 0 0 60px rgba(255,0,80,0.2)"
                : "0 0 20px rgba(0,245,255,0.2)",
            }}
            data-ocid="secure_comm.mic.toggle"
          >
            {isRecording ? (
              <Mic className="w-8 h-8" style={{ color: "#ff0080" }} />
            ) : (
              <MicOff className="w-8 h-8" style={{ color: "#00f5ff" }} />
            )}
            {isRecording && (
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ border: "2px solid rgba(255,0,80,0.4)" }}
              />
            )}
          </button>
          <span
            className="text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: isRecording ? "#ff0080" : "#00f5ff" }}
          >
            {isRecording ? "TRANSMITTING" : "HOLD TO TRANSMIT"}
          </span>
        </div>

        {/* Voice Mask Controls */}
        <div
          className="rounded-xl p-4 border border-cyan-500/20 space-y-3"
          style={{ background: "#0d1428" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
              VOICE MASK
            </span>
            <span className="font-mono text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
              MASK STRENGTH: {maskStrength}%
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {VOICE_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setVoiceStyle(style)}
                className="py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background:
                    voiceStyle === style
                      ? "rgba(0,245,255,0.15)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    voiceStyle === style
                      ? "1px solid rgba(0,245,255,0.7)"
                      : "1px solid rgba(255,255,255,0.08)",
                  color: voiceStyle === style ? "#00f5ff" : "#a7b0c2",
                  boxShadow:
                    voiceStyle === style
                      ? "0 0 12px rgba(0,245,255,0.5)"
                      : "none",
                }}
                data-ocid="secure_comm.voice_style.button"
              >
                {style}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <div className="flex items-center gap-2">
              {ghostMode && (
                <Skull
                  className="w-4 h-4 animate-pulse"
                  style={{ color: "#8b5cf6" }}
                />
              )}
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                GHOST MODE — ZERO TRACEABILITY
              </span>
            </div>
            <Switch
              checked={ghostMode}
              onCheckedChange={setGhostMode}
              data-ocid="secure_comm.ghost_mode.switch"
            />
          </div>
          {ghostMode && (
            <div
              className="text-[10px] text-center font-bold uppercase tracking-widest py-1.5 rounded-lg animate-pulse"
              style={{
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.4)",
                color: "#8b5cf6",
                boxShadow: "0 0 20px rgba(139,92,246,0.6)",
              }}
            >
              👻 FULL BIOMETRIC REMOVAL ACTIVE
            </div>
          )}
        </div>

        {/* Emotion Layer */}
        <div
          className="rounded-xl p-4 border border-cyan-500/20 space-y-3"
          style={{ background: "#0d1428" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
            EMOTION LAYER
          </span>
          <div className="grid grid-cols-3 gap-2">
            {EMOTIONS.map((em) => {
              const colors: Record<Emotion, string> = {
                CALM: "#00f5ff",
                SERIOUS: "#8b5cf6",
                ENERGETIC: "#ff0080",
              };
              const active = emotion === em;
              return (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmotion(em)}
                  className="py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: active
                      ? `${colors[em]}22`
                      : "rgba(255,255,255,0.04)",
                    border: active
                      ? `1px solid ${colors[em]}bb`
                      : "1px solid rgba(255,255,255,0.08)",
                    color: active ? colors[em] : "#a7b0c2",
                    boxShadow: active ? `0 0 12px ${colors[em]}66` : "none",
                  }}
                  data-ocid="secure_comm.emotion.button"
                >
                  {em}
                </button>
              );
            })}
          </div>
        </div>

        {/* Output Channel */}
        <div
          className="rounded-xl p-4 border border-cyan-500/20 space-y-3"
          style={{ background: "#0d1428" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
            OUTPUT CHANNEL
          </span>
          <div className="grid grid-cols-3 gap-2">
            {OUTPUT_MODES.map((mode) => {
              const active = outputMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOutputMode(mode)}
                  className="py-2 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all"
                  style={{
                    background: active
                      ? "rgba(0,245,255,0.12)"
                      : "rgba(255,255,255,0.04)",
                    border: active
                      ? "1px solid rgba(0,245,255,0.6)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: active ? "#00f5ff" : "#a7b0c2",
                    boxShadow: active ? "0 0 10px rgba(0,245,255,0.4)" : "none",
                  }}
                  data-ocid="secure_comm.output_mode.button"
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language & Translation */}
        <div
          className="rounded-xl p-4 border border-cyan-500/20 space-y-3"
          style={{ background: "#0d1428" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
            LANGUAGE & TRANSLATION
          </span>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">
              DETECTED LANG:
            </span>
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded"
              style={{
                background: "rgba(0,245,255,0.1)",
                border: "1px solid rgba(0,245,255,0.3)",
                color: "#00f5ff",
              }}
            >
              {detectedLang}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">
              TRANSLATE TO:
            </span>
            <Select
              value={targetLang}
              onValueChange={(v) => setTargetLang(v as TargetLang)}
            >
              <SelectTrigger
                className="w-24 h-7 text-[10px] font-mono border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                data-ocid="secure_comm.target_lang.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0d1428] border-cyan-500/30">
                {LANGS.map((lang) => (
                  <SelectItem
                    key={lang}
                    value={lang}
                    className="text-xs font-mono text-cyan-300 focus:bg-cyan-500/20"
                  >
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {translationBox && (
            <div
              className="font-mono text-[11px] p-3 rounded-lg leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(0,245,255,0.15)",
                color: "#a7b0c2",
              }}
            >
              {translationBox}
            </div>
          )}
        </div>

        {/* Live Subtitles */}
        {showSubtitles && (
          <div
            className="rounded-xl p-4 border border-cyan-500/20 space-y-2"
            style={{ background: "#0d1428" }}
            data-ocid="secure_comm.subtitles.panel"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
              LIVE SUBTITLES
            </span>
            <ScrollArea className="h-36">
              <div className="space-y-2 pr-2">
                {subtitles.length === 0 ? (
                  <p className="text-[10px] text-gray-500 font-mono italic">
                    Awaiting transmission...
                  </p>
                ) : (
                  subtitles.map((entry) => (
                    <div key={entry.id} className="space-y-0.5">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-[9px] text-gray-600 shrink-0 mt-0.5">
                          {entry.timestamp}
                        </span>
                        <span className="font-mono text-[10px] text-white/80">
                          {entry.original}
                        </span>
                      </div>
                      {targetLang !== "EN" && (
                        <div className="flex items-start gap-2 pl-2">
                          <span className="text-[9px] text-cyan-500 shrink-0 mt-0.5">
                            →
                          </span>
                          <span className="font-mono text-[10px] text-cyan-300">
                            {entry.translated}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Processing Pipeline */}
        <div
          className="rounded-xl p-4 border border-cyan-500/20 space-y-3"
          style={{ background: "#0d1428" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
              PIPELINE
            </span>
            <span className="font-mono text-[10px] text-gray-500">
              ~{simLatency}ms
            </span>
          </div>
          <div className="flex items-center gap-1">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-1 flex-1">
                <div
                  className="flex-1 text-center py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-200"
                  style={{
                    background:
                      processing && pipelineStage >= i
                        ? "rgba(0,245,255,0.2)"
                        : "rgba(255,255,255,0.04)",
                    border:
                      processing && pipelineStage >= i
                        ? "1px solid rgba(0,245,255,0.6)"
                        : "1px solid rgba(255,255,255,0.08)",
                    color:
                      processing && pipelineStage >= i ? "#00f5ff" : "#4a5568",
                    boxShadow:
                      processing && pipelineStage === i
                        ? "0 0 8px rgba(0,245,255,0.5)"
                        : "none",
                  }}
                >
                  {stage}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <span className="text-gray-600 text-[8px]">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security Indicators */}
        <div className="flex items-center justify-between gap-2 py-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse"
            style={{
              background: "rgba(0,245,255,0.08)",
              border: "1px solid rgba(0,245,255,0.3)",
              color: "#00f5ff",
            }}
          >
            🛡️ FINGERPRINT SHIELD
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "#10b981",
            }}
          >
            🔒 ZERO STORAGE
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#8b5cf6",
            }}
          >
            👻 ANTI-TRACE
          </div>
        </div>
      </main>
    </div>
  );
}
