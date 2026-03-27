import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface GhostDuelloProps {
  userPrice: number;
  sessionId: string;
  onBack: () => void;
}

function randomGhostId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "GHOST-";
  for (let i = 0; i < 4; i++)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function Particle({ x, y, color }: { x: number; y: number; color: string }) {
  const angle = Math.random() * 360;
  const dist = 60 + Math.random() * 120;
  const tx = Math.cos((angle * Math.PI) / 180) * dist;
  const ty = Math.sin((angle * Math.PI) / 180) * dist;
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{ left: x, top: y, background: color }}
      initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      animate={{ opacity: 0, scale: 0, x: tx, y: ty }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    />
  );
}

export default function GhostDuelloPage({
  userPrice,
  sessionId,
  onBack,
}: GhostDuelloProps) {
  const rivalId = useRef(randomGhostId()).current;
  const rivalPrice = useRef(
    Math.round(userPrice * (0.8 + Math.random() * 0.4)),
  ).current;
  const userWins = userPrice < rivalPrice;

  const [phase, setPhase] = useState<"countdown" | "reveal">("countdown");
  const [count, setCount] = useState(3);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; color: string }[]
  >([]);

  useEffect(() => {
    if (count <= 0) {
      setPhase("reveal");
      if (userWins) {
        const pts = Array.from({ length: 32 }, (_, i) => ({
          id: i,
          x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
          y: window.innerHeight / 2 + (Math.random() - 0.5) * 100,
          color: ["#00f5ff", "#a855ff", "#ffd700", "#00ff88"][i % 4],
        }));
        setParticles(pts);
        setTimeout(() => setParticles([]), 1500);
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [count, userWins]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #060812 0%, #0d0520 50%, #060812 100%)",
      }}
    >
      {/* Grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Particles */}
      {particles.map((p) => (
        <Particle key={p.id} x={p.x} y={p.y} color={p.color} />
      ))}

      {/* Header */}
      <motion.div
        className="text-center mb-8 z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: "#a855ff" }}
        >
          ⚔️ GHOST DÜELLO
        </div>
        <h1
          className="text-3xl md:text-5xl font-black tracking-widest uppercase"
          style={{
            color: "#00f5ff",
            textShadow:
              "0 0 30px rgba(0,245,255,0.7), 0 0 60px rgba(0,245,255,0.3)",
          }}
        >
          ARENA
        </h1>
      </motion.div>

      {/* Combatants */}
      <div className="flex items-center gap-6 md:gap-12 z-10 mb-8">
        {/* User */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div
            className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center text-3xl md:text-5xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,245,255,0.2), rgba(0,245,255,0.05))",
              border: "2px solid #00f5ff",
              boxShadow: "0 0 30px rgba(0,245,255,0.5)",
            }}
          >
            👤
          </div>
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: "#00f5ff" }}>
              {sessionId.slice(-8).toUpperCase()}
            </div>
            <div
              className="text-xl font-black"
              style={{
                color:
                  phase === "reveal"
                    ? userWins
                      ? "#00ff88"
                      : "#ff4444"
                    : "#00f5ff",
              }}
            >
              ₺{userPrice}
            </div>
            <div className="text-xs" style={{ color: "#a7b0c2" }}>
              SEN
            </div>
          </div>
        </motion.div>

        {/* VS */}
        <div className="flex flex-col items-center gap-2">
          <AnimatePresence mode="wait">
            {phase === "countdown" ? (
              <motion.div
                key={count}
                className="text-6xl md:text-8xl font-black"
                style={{
                  color: count === 0 ? "#ffd700" : "#ff4500",
                  textShadow: `0 0 40px ${count === 0 ? "rgba(255,215,0,0.8)" : "rgba(255,69,0,0.8)"}`,
                }}
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {count === 0 ? "HAZIR!" : count}
              </motion.div>
            ) : (
              <motion.div
                key="vs"
                className="text-4xl md:text-6xl font-black tracking-widest"
                style={{
                  color: "#ff4500",
                  textShadow: "0 0 30px rgba(255,69,0,0.8)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                VS
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rival */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div
            className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center text-3xl md:text-5xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))",
              border: "2px solid #a855ff",
              boxShadow: "0 0 30px rgba(168,85,247,0.5)",
            }}
          >
            👻
          </div>
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: "#a855ff" }}>
              {rivalId}
            </div>
            <div
              className="text-xl font-black"
              style={{
                color:
                  phase === "reveal"
                    ? userWins
                      ? "#ff4444"
                      : "#00ff88"
                    : "#a855ff",
              }}
            >
              ₺{rivalPrice}
            </div>
            <div className="text-xs" style={{ color: "#a7b0c2" }}>
              RAKİP
            </div>
          </div>
        </motion.div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {phase === "reveal" && (
          <motion.div
            className="z-10 text-center mb-8"
            initial={{ opacity: 0, scale: 0.5, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 250, delay: 0.2 }}
          >
            {userWins ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="text-2xl md:text-4xl font-black tracking-wide"
                  style={{
                    color: "#ffd700",
                    textShadow: "0 0 30px rgba(255,215,0,0.8)",
                  }}
                >
                  🏆 SEN KAZANDIN!
                </div>
                <motion.div
                  className="px-6 py-3 rounded-full font-black text-lg tracking-widest"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,215,0,0.25), rgba(0,255,136,0.15))",
                    border: "2px solid #ffd700",
                    color: "#ffd700",
                    boxShadow: "0 0 40px rgba(255,215,0,0.5)",
                  }}
                  animate={{
                    boxShadow: [
                      "0 0 20px rgba(255,215,0,0.4)",
                      "0 0 60px rgba(255,215,0,0.8)",
                      "0 0 20px rgba(255,215,0,0.4)",
                    ],
                  }}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: 1.5,
                  }}
                  data-ocid="duello.win_badge"
                >
                  🎉 %5 İNDİRİM KAZANDIN!
                </motion.div>
                <div className="text-sm" style={{ color: "#a7b0c2" }}>
                  Sürücüye indirim kodu göster:{" "}
                  <span style={{ color: "#00f5ff" }}>
                    GHOST-WIN-{sessionId.slice(-4).toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="text-2xl md:text-4xl font-black tracking-wide"
                  style={{
                    color: "#ff4444",
                    textShadow: "0 0 30px rgba(255,68,68,0.8)",
                  }}
                >
                  RAKİP KAZANDI!
                </div>
                <div
                  className="text-xl"
                  style={{ color: "#a7b0c2" }}
                  data-ocid="duello.lose_message"
                >
                  😤 Bir dahaki sefere...
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button */}
      <motion.div
        className="z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "reveal" ? 1 : 0 }}
        transition={{ delay: 0.8 }}
      >
        <button
          type="button"
          onClick={onBack}
          className="px-8 py-3 rounded-full font-bold tracking-widest uppercase text-sm transition-all"
          style={{
            background: "rgba(0,245,255,0.08)",
            border: "1px solid rgba(0,245,255,0.3)",
            color: "#00f5ff",
          }}
          data-ocid="duello.back_button"
        >
          ← DÖNÜŞ
        </button>
      </motion.div>
    </div>
  );
}
