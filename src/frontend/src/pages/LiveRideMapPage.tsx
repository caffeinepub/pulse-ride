import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type RidePhase =
  | "WAITING"
  | "MATCHED"
  | "DRIVER_APPROACHING"
  | "ARRIVED_PICKUP"
  | "IN_RIDE"
  | "COMPLETED";

interface Coord {
  lat: number;
  lng: number;
}

const PICKUP: Coord = { lat: 41.0082, lng: 28.9784 };
const DESTINATION: Coord = { lat: 41.02, lng: 28.99 };
const DRIVER_START: Coord = { lat: 41.005, lng: 28.97 };

const SESSION_ID = `GHOST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function coordToCanvas(
  coord: Coord,
  canvasW: number,
  canvasH: number,
  center: Coord,
  scale: number,
) {
  const x = canvasW / 2 + (coord.lng - center.lng) * scale;
  const y = canvasH / 2 - (coord.lat - center.lat) * scale;
  return { x, y };
}

const PHASE_LABELS: Record<RidePhase, string> = {
  WAITING: "PRE-MATCH — LOCATION BLURRED",
  MATCHED: "MATCH CONFIRMED — REVEALING...",
  DRIVER_APPROACHING: "DRIVER APPROACHING",
  ARRIVED_PICKUP: "DRIVER ARRIVED AT PICKUP",
  IN_RIDE: "IN RIDE",
  COMPLETED: "RIDE COMPLETE",
};

const PHASE_ORDER: RidePhase[] = [
  "WAITING",
  "MATCHED",
  "DRIVER_APPROACHING",
  "ARRIVED_PICKUP",
  "IN_RIDE",
  "COMPLETED",
];

interface LiveRideMapPageProps {
  onBack?: () => void;
}

export default function LiveRideMapPage({ onBack }: LiveRideMapPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const [phase, setPhase] = useState<RidePhase>("WAITING");
  const [_blurPx, setBlurPx] = useState(20);
  const [panicMode, setPanicMode] = useState(false);
  const [panicFlash, setPanicFlash] = useState(false);
  const [showWipe, setShowWipe] = useState(false);
  const [eta, setEta] = useState(480); // seconds
  const [glitch, setGlitch] = useState(false);

  // Driver position (interpolated)
  const driverPosRef = useRef<Coord>({ ...DRIVER_START });
  const phaseStartRef = useRef<number>(Date.now());
  const phaseRef = useRef<RidePhase>("WAITING");
  const blurRef = useRef(20);
  const panicRef = useRef(false);

  // Jitter for pre-match blur
  const jitterRef = useRef({ x: 0, y: 0 });

  const triggerGlitch = useCallback(() => {
    setGlitch(true);
    setTimeout(() => setGlitch(false), 400);
  }, []);

  const advancePhase = useCallback(() => {
    setPhase((prev) => {
      const idx = PHASE_ORDER.indexOf(prev);
      if (idx < PHASE_ORDER.length - 1) {
        const next = PHASE_ORDER[idx + 1];
        phaseRef.current = next;
        phaseStartRef.current = Date.now();
        triggerGlitch();
        return next;
      }
      return prev;
    });
  }, [triggerGlitch]);

  // Phase auto-advance timer
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => advancePhase(), 5000)); // WAITING → MATCHED
    timers.push(setTimeout(() => advancePhase(), 16000)); // MATCHED → DRIVER_APPROACHING
    timers.push(setTimeout(() => advancePhase(), 28000)); // → ARRIVED_PICKUP
    timers.push(setTimeout(() => advancePhase(), 33000)); // → IN_RIDE
    timers.push(setTimeout(() => advancePhase(), 48000)); // → COMPLETED
    return () => timers.forEach(clearTimeout);
  }, [advancePhase]);

  // ETA countdown
  useEffect(() => {
    const id = setInterval(() => setEta((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Jitter update every 2s in WAITING
  useEffect(() => {
    if (phase !== "WAITING") return;
    const id = setInterval(() => {
      jitterRef.current = {
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 40,
      };
    }, 2000);
    return () => clearInterval(id);
  }, [phase]);

  // Blur decrease during MATCHED phase
  useEffect(() => {
    if (phase !== "MATCHED") return;
    const id = setInterval(() => {
      setBlurPx((p) => {
        const next = Math.max(0, p - 2);
        blurRef.current = next;
        return next;
      });
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const CENTER: Coord = {
      lat: (PICKUP.lat + DESTINATION.lat) / 2,
      lng: (PICKUP.lng + DESTINATION.lng) / 2,
    };
    const SCALE = 8000;

    let t = 0;
    const draw = () => {
      t += 0.016;
      const W = canvas.width;
      const H = canvas.height;
      const currentPhase = phaseRef.current;
      const currentPanic = panicRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#050a05";
      ctx.fillRect(0, 0, W, H);

      if (currentPanic) {
        // Panic overlay
        ctx.filter = "blur(20px)";
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, W, H);
        ctx.filter = "none";
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Grid
      ctx.filter = "none";
      ctx.strokeStyle = "#0d2010";
      ctx.lineWidth = 1;
      const gridSpacing = 60;
      for (let x = 0; x < W; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Roads — diagonal/angled for cyberpunk feel
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 3;
      const roads = [
        [0.2, 0, 0.8, 1],
        [0, 0.3, 1, 0.7],
        [0.1, 0.6, 0.9, 0.4],
        [0, 0.1, 0.5, 0.9],
        [0.5, 0, 1, 0.6],
      ];
      for (const [x1r, y1r, x2r, y2r] of roads) {
        ctx.beginPath();
        ctx.moveTo(x1r * W, y1r * H);
        ctx.lineTo(x2r * W, y2r * H);
        ctx.stroke();
      }

      const pickupPx = coordToCanvas(PICKUP, W, H, CENTER, SCALE);
      const destPx = coordToCanvas(DESTINATION, W, H, CENTER, SCALE);

      const isRevealed =
        currentPhase !== "WAITING" && currentPhase !== "MATCHED";

      // Route line (post-match)
      if (isRevealed) {
        ctx.save();
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(pickupPx.x, pickupPx.y);
        ctx.lineTo(destPx.x, destPx.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Driver position update
      let driverTarget: Coord;
      if (currentPhase === "WAITING" || currentPhase === "MATCHED") {
        driverTarget = DRIVER_START;
      } else if (
        currentPhase === "DRIVER_APPROACHING" ||
        currentPhase === "ARRIVED_PICKUP"
      ) {
        driverTarget = PICKUP;
      } else {
        driverTarget = DESTINATION;
      }

      driverPosRef.current = {
        lat: lerp(driverPosRef.current.lat, driverTarget.lat, 0.01),
        lng: lerp(driverPosRef.current.lng, driverTarget.lng, 0.01),
      };

      const driverPx = coordToCanvas(driverPosRef.current, W, H, CENTER, SCALE);

      // Draw driver (with blur pre-match)
      const currentBlur = blurRef.current;
      if (currentPhase === "WAITING" || currentPhase === "MATCHED") {
        const jx = driverPx.x + jitterRef.current.x;
        const jy = driverPx.y + jitterRef.current.y;

        // Radius circle
        ctx.save();
        ctx.strokeStyle = "rgba(0,255,136,0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(jx, jy, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Blurred glow
        ctx.filter = `blur(${currentBlur}px)`;
        const grad = ctx.createRadialGradient(jx, jy, 0, jx, jy, 40);
        grad.addColorStop(0, "rgba(0,255,136,0.8)");
        grad.addColorStop(1, "rgba(0,255,136,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(jx, jy, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = "none";
        ctx.restore();
      } else {
        // Car emoji
        ctx.save();
        ctx.font = "24px serif";
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 12;
        // Bob animation
        const bob = Math.sin(t * 3) * 2;
        ctx.fillText("🚗", driverPx.x - 12, driverPx.y + 8 + bob);
        ctx.restore();
      }

      // Pickup pin A
      ctx.save();
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(pickupPx.x, pickupPx.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#050a05";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("A", pickupPx.x, pickupPx.y);
      ctx.restore();

      // Label A
      ctx.fillStyle = "#00ff88";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("PICKUP", pickupPx.x + 12, pickupPx.y - 4);

      // Destination pin B
      ctx.save();
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(destPx.x, destPx.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("B", destPx.x, destPx.y);
      ctx.restore();

      ctx.fillStyle = "#a855f7";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("DEST", destPx.x + 12, destPx.y - 4);

      // Scan line effect
      const scanY = (t * 80) % H;
      const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
      scanGrad.addColorStop(0, "rgba(0,255,136,0)");
      scanGrad.addColorStop(0.5, "rgba(0,255,136,0.06)");
      scanGrad.addColorStop(1, "rgba(0,255,136,0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 2, W, 4);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handlePanic = useCallback(() => {
    setPanicFlash(true);
    setTimeout(() => setPanicFlash(false), 200);
    setPanicMode(true);
    panicRef.current = true;
    triggerGlitch();
    toast.error("GHOST MODE ACTIVATED — Location hidden");
  }, [triggerGlitch]);

  const handleResumeTracking = useCallback(() => {
    setPanicMode(false);
    panicRef.current = false;
    triggerGlitch();
    toast.success("Tracking resumed");
  }, [triggerGlitch]);

  const handleExit = useCallback(() => {
    setShowWipe(true);
    toast("🗑️ GPS DATA WIPED — Session terminated", {
      duration: 3000,
    });
    setTimeout(() => {
      if (onBack) onBack();
      else window.history.back();
    }, 2000);
  }, [onBack]);

  const formatEta = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isRevealed = phase !== "WAITING" && phase !== "MATCHED" && !panicMode;

  const phaseColor: Record<RidePhase, string> = {
    WAITING: "#f59e0b",
    MATCHED: "#00ff88",
    DRIVER_APPROACHING: "#00ffff",
    ARRIVED_PICKUP: "#00ff88",
    IN_RIDE: "#00ffff",
    COMPLETED: "#a855f7",
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black select-none"
      data-ocid="live_map.page"
    >
      {/* Panic flash */}
      <AnimatePresence>
        {panicFlash && (
          <motion.div
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ background: "#ff0044" }}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Data wipe overlay */}
      <AnimatePresence>
        {showWipe && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.95)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center font-mono">
              <div className="text-5xl mb-4">🗑️</div>
              <p
                className="text-2xl font-black tracking-widest"
                style={{ color: "#00ff88" }}
              >
                GPS DATA WIPED
              </p>
              <p className="text-sm text-gray-400 mt-2 tracking-wider">
                SESSION TERMINATED — ZERO TRACE
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Glitch overlay */}
      <AnimatePresence>
        {glitch && (
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              background:
                "linear-gradient(transparent 48%, rgba(0,255,136,0.08) 50%, transparent 52%)",
              backgroundSize: "100% 4px",
            }}
          />
        )}
      </AnimatePresence>

      {/* Panic mode overlay */}
      <AnimatePresence>
        {panicMode && (
          <motion.div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(8px)",
            }}
            data-ocid="live_map.panic.modal"
          >
            <div className="text-center font-mono px-8">
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2 }}
                className="text-6xl mb-4"
              >
                👻
              </motion.div>
              <h2
                className="text-3xl font-black tracking-widest mb-2"
                style={{ color: "#ff0044" }}
              >
                LOCATION HIDDEN
              </h2>
              <p
                className="text-sm tracking-wider mb-2"
                style={{ color: "#ff6680" }}
              >
                GHOST MODE ACTIVE
              </p>
              <p className="text-xs text-gray-400 tracking-wider mb-8 max-w-xs">
                Exact location hidden. Session continues anonymously. Driver
                cannot see your coordinates.
              </p>
              <button
                type="button"
                onClick={handleResumeTracking}
                className="px-8 py-3 font-mono font-bold text-sm tracking-widest uppercase rounded-full border transition-all"
                style={{
                  border: "1px solid rgba(0,255,136,0.5)",
                  color: "#00ff88",
                  background: "rgba(0,255,136,0.08)",
                }}
                data-ocid="live_map.resume_tracking.button"
              >
                RESUME TRACKING
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD — Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between p-3 pointer-events-none">
        {/* Session ID */}
        <div
          className="font-mono text-xs tracking-widest px-3 py-1.5 rounded-full pointer-events-auto"
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(0,255,136,0.3)",
            color: "#00ff88",
          }}
          data-ocid="live_map.session.panel"
        >
          {SESSION_ID}
        </div>

        {/* Phase label */}
        <div
          className={`font-mono text-xs tracking-widest px-3 py-1.5 rounded-full ${
            glitch ? "animate-pulse" : ""
          }`}
          style={{
            background: "rgba(0,0,0,0.7)",
            border: `1px solid ${phaseColor[phase]}40`,
            color: phaseColor[phase],
          }}
        >
          {panicMode ? "👻 GHOST MODE" : PHASE_LABELS[phase]}
        </div>

        {/* ETA */}
        <div
          className="font-mono text-xs tracking-widest px-3 py-1.5 rounded-full pointer-events-auto"
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(0,255,255,0.3)",
            color: "#00ffff",
          }}
        >
          ETA: {formatEta(eta)}
        </div>
      </div>

      {/* Security badges */}
      <div className="absolute top-14 left-0 right-0 z-20 flex items-center justify-center gap-2 pointer-events-none">
        {["🔒 ENCRYPTED", "👻 ANONYMOUS", "🛡️ SECURE"].map((badge) => (
          <span
            key={badge}
            className="font-mono text-[9px] tracking-widest px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {badge}
          </span>
        ))}
      </div>

      {/* HUD — Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3">
        <motion.div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(5,10,5,0.92)",
            border: "1px solid rgba(0,255,136,0.2)",
            backdropFilter: "blur(16px)",
          }}
          layout
        >
          {/* Coordinate display */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                DRIVER COORDINATES
              </span>
              <span
                className="font-mono text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: isRevealed
                    ? "rgba(0,255,136,0.1)"
                    : "rgba(255,165,0,0.1)",
                  color: isRevealed ? "#00ff88" : "#f59e0b",
                  border: `1px solid ${isRevealed ? "rgba(0,255,136,0.3)" : "rgba(255,165,0,0.3)"}`,
                }}
              >
                {isRevealed ? "EXACT" : "BLURRED"}
              </span>
            </div>

            <div
              className="font-mono text-sm tracking-wider"
              style={{
                color: isRevealed ? "#00ffff" : "rgba(255,255,255,0.3)",
              }}
              data-ocid="live_map.coordinates.panel"
            >
              {isRevealed ? (
                <span>
                  📍 {driverPosRef.current.lat.toFixed(6)}°N,{" "}
                  {driverPosRef.current.lng.toFixed(6)}°E
                </span>
              ) : (
                <span>📍 ±800m accuracy — exact location hidden</span>
              )}
            </div>
          </div>

          {/* Phase progress */}
          <div className="flex gap-1 mb-3">
            {PHASE_ORDER.slice(0, -1).map((p) => {
              const idx = PHASE_ORDER.indexOf(p);
              const curIdx = PHASE_ORDER.indexOf(phase);
              return (
                <div
                  key={p}
                  className="flex-1 h-1 rounded-full transition-all duration-700"
                  style={{
                    background:
                      idx <= curIdx
                        ? phaseColor[phase]
                        : "rgba(255,255,255,0.1)",
                  }}
                />
              );
            })}
          </div>

          {/* Completed message */}
          <AnimatePresence>
            {phase === "COMPLETED" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-3 font-mono"
              >
                <p
                  className="text-lg font-black tracking-widest"
                  style={{ color: "#a855f7" }}
                >
                  🏁 RIDE COMPLETE
                </p>
                <p className="text-xs text-gray-400 tracking-wider">
                  Cash payment confirmed — all data wiped
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Arrived banner */}
          <AnimatePresence>
            {phase === "ARRIVED_PICKUP" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center mb-3 font-mono px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.3)",
                }}
              >
                <p
                  className="text-sm font-bold tracking-widest"
                  style={{ color: "#00ff88" }}
                >
                  🚗 DRIVER ARRIVED AT PICKUP
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!panicMode ? (
              <button
                type="button"
                onClick={handlePanic}
                className="flex-1 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                style={{
                  background: "rgba(255,0,68,0.12)",
                  border: "1px solid rgba(255,0,68,0.5)",
                  color: "#ff0044",
                }}
                data-ocid="live_map.panic.button"
              >
                🚨 PANIC MODE
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResumeTracking}
                className="flex-1 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                style={{
                  background: "rgba(0,255,136,0.12)",
                  border: "1px solid rgba(0,255,136,0.5)",
                  color: "#00ff88",
                }}
                data-ocid="live_map.resume_tracking.button"
              >
                ▶ RESUME TRACKING
              </button>
            )}
            <button
              type="button"
              onClick={handleExit}
              className="px-5 py-3 font-mono font-bold text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
              }}
              data-ocid="live_map.exit.button"
            >
              EXIT
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
