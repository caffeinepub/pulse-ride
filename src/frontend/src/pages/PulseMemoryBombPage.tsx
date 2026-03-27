import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface PulseMemoryBombProps {
  sessionId: string;
  mood?: string;
  onBack: () => void;
}

const MOODS = [
  { emoji: "😊", label: "JOY", pulse: "LOW" },
  { emoji: "😤", label: "RUSH", pulse: "HIGH" },
  { emoji: "🎵", label: "VIBE", pulse: "MED" },
  { emoji: "🔥", label: "HYPE", pulse: "PEAK" },
  { emoji: "❄️", label: "CHILL", pulse: "ZERO" },
];

const DISTANCES = ["3.2km", "7.8km", "12.4km", "5.1km", "18.9km", "9.3km"];

function generateCapsuleText(
  sessionId: string,
  moodEmoji: string,
  moodLabel: string,
  pulse: string,
) {
  const dist = DISTANCES[Math.floor(Math.random() * DISTANCES.length)];
  const zones = [
    "KADIKÖY",
    "BEŞİKTAŞ",
    "ÜSKÜDAR",
    "ŞİŞLİ",
    "MALTEPE",
    "BAĞCILAR",
  ];
  const from = zones[Math.floor(Math.random() * zones.length)];
  const to = zones[Math.floor(Math.random() * zones.length)];
  const fareRange = ["₺89", "₺124", "₺67", "₺156", "₺98", "₺203"];
  const fare = fareRange[Math.floor(Math.random() * fareRange.length)];
  const shortId = sessionId.slice(-6).toUpperCase();
  return `GHOST-${shortId} | DIST:${dist} | ROUTE:${from}→${to} | FARE:${fare} | MOOD:${moodEmoji} | PULSE:${pulse} | MOOD_LABEL:${moodLabel}`;
}

function useTypewriter(text: string, enabled: boolean, speed = 28) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);
  useEffect(() => {
    if (!enabled) {
      setDisplayed("");
      idx.current = 0;
      return;
    }
    idx.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, enabled, speed]);
  return displayed;
}

export default function PulseMemoryBombPage({
  sessionId,
  mood,
  onBack,
}: PulseMemoryBombProps) {
  const STORAGE_KEY = "pulse_capsule";

  const [storedCapsule, setStoredCapsule] = useState<{
    text: string;
    unlockAt: number;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [selectedMood, setSelectedMood] = useState(mood || "");
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const capsuleText = storedCapsule?.text || "";
  const unlockAt = storedCapsule?.unlockAt || 0;
  const isUnlocked = storedCapsule && now >= unlockAt;
  const typewriterText = useTypewriter(capsuleText, !!isUnlocked);

  function handleLock() {
    const moodObj = MOODS.find((m) => m.emoji === selectedMood) || MOODS[2];
    const text = generateCapsuleText(
      sessionId,
      moodObj.emoji,
      moodObj.label,
      moodObj.pulse,
    );
    const unlockAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const capsule = { text, unlockAt };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capsule));
    setStoredCapsule(capsule);
    setSaved(true);
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setStoredCapsule(null);
    setSaved(false);
    setSelectedMood("");
  }

  function formatCountdown(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${d}G ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #060812 0%, #0a0318 50%, #060812 100%)",
      }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        className="w-full max-w-md z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: "#a855ff" }}
          >
            💣 PULSE SİSTEMİ
          </div>
          <h1
            className="text-3xl font-black tracking-widest uppercase"
            style={{
              color: "#00f5ff",
              textShadow: "0 0 30px rgba(0,245,255,0.6)",
            }}
          >
            HAFIZA BOMBASI
          </h1>
          <p className="text-xs mt-2" style={{ color: "#a7b0c2" }}>
            Yolculuğun anonim bir izi — 7 gün kilitle, sonra aç
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* CREATE MODE */}
          {!storedCapsule && !saved && (
            <motion.div
              key="create"
              className="rounded-2xl p-6 flex flex-col gap-5"
              style={{
                background: "rgba(168,85,247,0.07)",
                border: "1px solid rgba(168,85,247,0.3)",
                boxShadow: "0 0 30px rgba(168,85,247,0.1)",
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div>
                <div
                  className="text-xs font-bold tracking-widest mb-3"
                  style={{ color: "#a855ff" }}
                >
                  RUHUNU SEÇ
                </div>
                <div className="flex gap-3 justify-center">
                  {MOODS.map((m) => (
                    <button
                      key={m.emoji}
                      type="button"
                      onClick={() => setSelectedMood(m.emoji)}
                      className="w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all"
                      style={{
                        background:
                          selectedMood === m.emoji
                            ? "rgba(168,85,247,0.3)"
                            : "rgba(255,255,255,0.04)",
                        border:
                          selectedMood === m.emoji
                            ? "2px solid #a855ff"
                            : "1px solid rgba(255,255,255,0.08)",
                        boxShadow:
                          selectedMood === m.emoji
                            ? "0 0 20px rgba(168,85,247,0.5)"
                            : "none",
                        transform:
                          selectedMood === m.emoji ? "scale(1.15)" : "scale(1)",
                      }}
                      data-ocid={`capsule.mood_${m.label.toLowerCase()}.button`}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLock}
                disabled={!selectedMood}
                className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all disabled:opacity-40"
                style={{
                  background: selectedMood
                    ? "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(0,245,255,0.15))"
                    : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(168,85,247,0.5)",
                  color: "#a855ff",
                  boxShadow: selectedMood
                    ? "0 0 20px rgba(168,85,247,0.3)"
                    : "none",
                }}
                data-ocid="capsule.lock_button"
              >
                KAPSÜLÜ KILITLE 🔒
              </button>
            </motion.div>
          )}

          {/* SAVED / LOCKED */}
          {storedCapsule && !isUnlocked && (
            <motion.div
              key="locked"
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <motion.div
                className="text-8xl"
                animate={{
                  filter: [
                    "drop-shadow(0 0 20px rgba(168,85,247,0.6))",
                    "drop-shadow(0 0 40px rgba(168,85,247,1))",
                    "drop-shadow(0 0 20px rgba(168,85,247,0.6))",
                  ],
                }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
              >
                🔒
              </motion.div>
              <div
                className="rounded-xl px-6 py-4 text-center"
                style={{
                  background: "rgba(168,85,247,0.1)",
                  border: "1px solid rgba(168,85,247,0.3)",
                }}
                data-ocid="capsule.countdown_panel"
              >
                <div
                  className="text-xs font-bold tracking-widest mb-2"
                  style={{ color: "#a855ff" }}
                >
                  AÇILIŞA KALAN
                </div>
                <div
                  className="text-3xl font-black font-mono"
                  style={{ color: "#00f5ff" }}
                >
                  {formatCountdown(unlockAt - now)}
                </div>
              </div>
              <div className="text-xs text-center" style={{ color: "#a7b0c2" }}>
                Kapsül korunuyor. 7 gün sonra anıların açığa çıkacak.
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs px-4 py-2 rounded-full transition-all"
                style={{
                  border: "1px solid rgba(255,68,68,0.3)",
                  color: "#ff4444",
                }}
                data-ocid="capsule.reset_button"
              >
                🗑️ Kapsülü Sil
              </button>
            </motion.div>
          )}

          {/* UNLOCKED */}
          {storedCapsule && isUnlocked && (
            <motion.div
              key="unlocked"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.div
                className="text-7xl"
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                🔓
              </motion.div>
              <div
                className="text-xl font-black tracking-widest"
                style={{
                  color: "#00ff88",
                  textShadow: "0 0 20px rgba(0,255,136,0.6)",
                }}
              >
                KAPSÜL AÇILDI!
              </div>
              <div
                className="w-full rounded-xl p-4 font-mono text-sm leading-relaxed"
                style={{
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.3)",
                  color: "#00ff88",
                  minHeight: "80px",
                }}
                data-ocid="capsule.reveal_panel"
              >
                {typewriterText}
                <span className="animate-pulse">█</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs px-4 py-2 rounded-full transition-all"
                style={{
                  border: "1px solid rgba(0,245,255,0.3)",
                  color: "#00f5ff",
                }}
                data-ocid="capsule.new_button"
              >
                ✨ Yeni Kapsül Oluştur
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="fixed top-4 left-4 z-20 px-4 py-2 rounded-full font-bold text-xs tracking-widest uppercase transition-all"
        style={{
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(0,245,255,0.3)",
          color: "#00f5ff",
        }}
        data-ocid="capsule.back_button"
      >
        ← GERİ
      </button>
    </div>
  );
}
