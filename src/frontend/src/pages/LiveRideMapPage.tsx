import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import { toast } from "sonner";

// Fix leaflet default icon
(L.Icon.Default.prototype as any)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

// Custom marker icons
const pickupIcon = L.divIcon({
  html: '<div style="background:#00ff88;width:16px;height:16px;border-radius:50%;border:2px solid #050a05;box-shadow:0 0 12px #00ff88;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:9px;color:#050a05;">A</div>',
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const destIcon = L.divIcon({
  html: '<div style="background:#a855f7;width:16px;height:16px;border-radius:50%;border:2px solid #050a05;box-shadow:0 0 12px #a855f7;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:9px;color:#fff;">B</div>',
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const driverIcon = L.divIcon({
  html: '<div style="font-size:24px;filter:drop-shadow(0 0 8px #00ff88);">🚗</div>',
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function DriverMarker({ phase }: { phase: RidePhase }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const posRef = useRef<Coord>({ ...DRIVER_START });

  useEffect(() => {
    const marker = L.marker([posRef.current.lat, posRef.current.lng], {
      icon: driverIcon,
    });
    marker.addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
    };
  }, [map]);

  useEffect(() => {
    const target =
      phase === "WAITING" || phase === "MATCHED"
        ? DRIVER_START
        : phase === "DRIVER_APPROACHING" || phase === "ARRIVED_PICKUP"
          ? PICKUP
          : DESTINATION;

    const interval = setInterval(() => {
      posRef.current = {
        lat: posRef.current.lat + (target.lat - posRef.current.lat) * 0.05,
        lng: posRef.current.lng + (target.lng - posRef.current.lng) * 0.05,
      };
      markerRef.current?.setLatLng([posRef.current.lat, posRef.current.lng]);
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  return null;
}

interface LiveRideMapPageProps {
  onBack?: () => void;
}

export default function LiveRideMapPage({ onBack }: LiveRideMapPageProps) {
  const [phase, setPhase] = useState<RidePhase>("WAITING");
  const [panicMode, setPanicMode] = useState(false);
  const [panicFlash, setPanicFlash] = useState(false);
  const [showWipe, setShowWipe] = useState(false);
  const [eta, setEta] = useState(480);
  const [glitch, setGlitch] = useState(false);

  const driverPosRef = useRef<Coord>({ ...DRIVER_START });
  const phaseRef = useRef<RidePhase>("WAITING");

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
        triggerGlitch();
        return next;
      }
      return prev;
    });
  }, [triggerGlitch]);

  // Phase auto-advance timer
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => advancePhase(), 5000));
    timers.push(setTimeout(() => advancePhase(), 16000));
    timers.push(setTimeout(() => advancePhase(), 28000));
    timers.push(setTimeout(() => advancePhase(), 33000));
    timers.push(setTimeout(() => advancePhase(), 48000));
    return () => timers.forEach(clearTimeout);
  }, [advancePhase]);

  // ETA countdown
  useEffect(() => {
    const id = setInterval(() => setEta((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const handlePanic = useCallback(() => {
    setPanicFlash(true);
    setTimeout(() => setPanicFlash(false), 200);
    setPanicMode(true);
    triggerGlitch();
    toast.error("GHOST MODE ACTIVATED — Location hidden");
  }, [triggerGlitch]);

  const handleResumeTracking = useCallback(() => {
    setPanicMode(false);
    triggerGlitch();
    toast.success("Tracking resumed");
  }, [triggerGlitch]);

  const handleExit = useCallback(() => {
    setShowWipe(true);
    toast("🗑️ GPS DATA WIPED — Session terminated", { duration: 3000 });
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

      {/* Leaflet Map */}
      <div
        className="absolute inset-0"
        style={{ filter: panicMode ? "blur(20px)" : "none" }}
      >
        <MapContainer
          center={[41.013, 28.984]}
          zoom={14}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <Marker position={[PICKUP.lat, PICKUP.lng]} icon={pickupIcon} />
          <Marker
            position={[DESTINATION.lat, DESTINATION.lng]}
            icon={destIcon}
          />
          <Polyline
            positions={[
              [PICKUP.lat, PICKUP.lng],
              [DESTINATION.lat, DESTINATION.lng],
            ]}
            pathOptions={{
              color: "#00ffff",
              weight: 2,
              dashArray: "8 6",
              opacity: isRevealed ? 1 : 0,
            }}
          />
          <DriverMarker phase={phase} />
        </MapContainer>
      </div>

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
                  border: `1px solid ${
                    isRevealed ? "rgba(0,255,136,0.3)" : "rgba(255,165,0,0.3)"
                  }`,
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
