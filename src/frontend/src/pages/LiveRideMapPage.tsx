/* eslint-disable */
// @ts-nocheck
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Leaflet CDN loader ───────────────────────────────────────────────────────
function ensureLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).L) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

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

const SESSION_ID = `GHOST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const PHASE_LABELS: Record<RidePhase, string> = {
  WAITING: "Konum alınıyor...",
  MATCHED: "Eşleşme onaylandı",
  DRIVER_APPROACHING: "Sürücü yaklaşıyor",
  ARRIVED_PICKUP: "Sürücü geldi",
  IN_RIDE: "Yolculuk devam ediyor",
  COMPLETED: "Yolculuk tamamlandı",
};

const PHASE_ORDER: RidePhase[] = [
  "WAITING",
  "MATCHED",
  "DRIVER_APPROACHING",
  "ARRIVED_PICKUP",
  "IN_RIDE",
  "COMPLETED",
];

const phaseBadgeStyle: Record<RidePhase, { bg: string; text: string }> = {
  WAITING: { bg: "#FEF3C7", text: "#92400E" },
  MATCHED: { bg: "#DBEAFE", text: "#1E40AF" },
  DRIVER_APPROACHING: { bg: "#DBEAFE", text: "#276EF1" },
  ARRIVED_PICKUP: { bg: "#D1FAE5", text: "#065F46" },
  IN_RIDE: { bg: "#EDE9FE", text: "#5B21B6" },
  COMPLETED: { bg: "#D1FAE5", text: "#05944F" },
};

function calcBearing(from: [number, number], to: [number, number]): number {
  return Math.atan2(to[1] - from[1], to[0] - from[0]) * (180 / Math.PI);
}

interface LiveRideMapPageProps {
  onBack?: () => void;
  pickupCoord?: Coord;
  destCoord?: Coord;
}

export default function LiveRideMapPage({
  onBack,
  pickupCoord,
  destCoord,
}: LiveRideMapPageProps) {
  const pickup: Coord = pickupCoord ?? { lat: 41.0082, lng: 28.9784 };
  const destination: Coord = destCoord ?? { lat: 41.0451, lng: 28.9994 };

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const stepRef = useRef(0);
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickupSnap = useRef(pickup);
  const destSnap = useRef(destination);

  const [phase, setPhase] = useState<RidePhase>("WAITING");
  const [panicMode, setPanicMode] = useState(false);
  const [panicFlash, setPanicFlash] = useState(false);
  const [showWipe, setShowWipe] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null);
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null);
  const [etaCountdown, setEtaCountdown] = useState(600);
  const [carRunning, setCarRunning] = useState(false);

  useEffect(() => {
    let destroyed = false;
    const p = pickupSnap.current;
    const d = destSnap.current;

    ensureLeaflet().then(() => {
      if (destroyed || !mapContainerRef.current) return;
      const L = (window as any).L;

      L.Icon.Default.prototype._getIconUrl = undefined;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current, {
        center: [(p.lat + d.lat) / 2, (p.lng + d.lng) / 2],
        zoom: 13,
        zoomControl: false,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
        },
      ).addTo(map);

      // Pickup marker — green dot
      const pickupIcon = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#05944F;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([p.lat, p.lng], { icon: pickupIcon }).addTo(map);

      // Destination marker — blue dot
      const destIconEl = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#276EF1;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([d.lat, d.lng], { icon: destIconEl }).addTo(map);

      // Car marker
      const carIcon = L.divIcon({
        html: `<div style="font-size:24px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">🚗</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      carMarkerRef.current = L.marker([p.lat, p.lng], {
        icon: carIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      const url = `https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&steps=true`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (destroyed) return;
          if (data.routes?.length > 0) {
            const route = data.routes[0];
            const coords: [number, number][] = route.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]],
            );
            routeCoordsRef.current = coords;
            // Route shadow
            L.polyline(coords, {
              color: "#000",
              weight: 10,
              opacity: 0.15,
            }).addTo(map);
            // Route line — Uber blue
            L.polyline(coords, {
              color: "#276EF1",
              weight: 5,
              opacity: 1,
            }).addTo(map);
            map.fitBounds(L.latLngBounds(coords), {
              padding: [80, 80],
              maxZoom: 16,
            });
            setOsrmDistance(route.distance);
            setOsrmDuration(route.duration);
            setEtaCountdown(Math.round(route.duration));
            setRouteLoading(false);
            setCarRunning(true);
          }
        })
        .catch(() => {
          if (destroyed) return;
          const fallback: [number, number][] = [
            [p.lat, p.lng],
            [d.lat, d.lng],
          ];
          routeCoordsRef.current = fallback;
          L.polyline(fallback, {
            color: "#276EF1",
            weight: 5,
            opacity: 1,
          }).addTo(map);
          setRouteLoading(false);
          setCarRunning(true);
          toast.error("Rota yüklenemedi, düz hat kullanılıyor");
        });
    });

    return () => {
      destroyed = true;
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Car animation along real route waypoints
  useEffect(() => {
    if (!carRunning) return;
    const L = (window as any).L;
    if (!L || !carMarkerRef.current) return;
    const stepsPerTick = Math.max(1, routeCoordsRef.current.length / 450);
    animIntervalRef.current = setInterval(() => {
      const coords = routeCoordsRef.current;
      if (coords.length < 2) return;
      const idx = Math.min(Math.floor(stepRef.current), coords.length - 1);
      const nextIdx = Math.min(idx + 1, coords.length - 1);
      const bearing = calcBearing(coords[idx], coords[nextIdx]);
      carMarkerRef.current.setLatLng(coords[idx]);
      carMarkerRef.current.setIcon(
        L.divIcon({
          html: `<div style="font-size:24px;transform:rotate(${bearing}deg);display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">🚗</div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      );
      stepRef.current += stepsPerTick;
      if (stepRef.current >= coords.length - 1) {
        stepRef.current = coords.length - 1;
        if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      }
    }, 100);
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [carRunning]);

  // ETA countdown
  useEffect(() => {
    if (!carRunning) return;
    const id = setInterval(
      () => setEtaCountdown((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [carRunning]);

  const advancePhase = useCallback(() => {
    setPhase((prev) => {
      const idx = PHASE_ORDER.indexOf(prev);
      if (idx < PHASE_ORDER.length - 1) return PHASE_ORDER[idx + 1];
      return prev;
    });
  }, []);

  useEffect(() => {
    const timers = [
      setTimeout(() => advancePhase(), 4000),
      setTimeout(() => advancePhase(), 12000),
      setTimeout(() => advancePhase(), 22000),
      setTimeout(() => advancePhase(), 28000),
      setTimeout(() => advancePhase(), 46000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [advancePhase]);

  const handlePanic = useCallback(() => {
    setPanicFlash(true);
    setTimeout(() => setPanicFlash(false), 200);
    setPanicMode(true);
    toast.error("🚨 Konum gizlendi — Ghost Mode aktif");
  }, []);

  const handleResumeTracking = useCallback(() => {
    setPanicMode(false);
    toast.success("✅ Takip devam ediyor");
  }, []);

  const handleExit = useCallback(() => {
    setShowWipe(true);
    toast("Oturum sonlandırıldı — veriler silindi", { duration: 3000 });
    setTimeout(() => {
      if (onBack) onBack();
      else window.history.back();
    }, 2000);
  }, [onBack]);

  const formatEta = (secs: number) => {
    const m = Math.floor(secs / 60);
    return m < 1 ? "<1 dk" : `${m} dk`;
  };
  const formatDist = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

  const phaseProgress =
    (PHASE_ORDER.indexOf(phase) / (PHASE_ORDER.length - 1)) * 100;
  const badgeStyle = phaseBadgeStyle[phase];

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-gray-900 select-none"
      data-ocid="live_map.page"
    >
      {/* Panic flash overlay */}
      <AnimatePresence>
        {panicFlash && (
          <motion.div
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ background: "#E11900" }}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Data wipe overlay — keep dark */}
      <AnimatePresence>
        {showWipe && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.97)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: 2, duration: 0.4 }}
                className="text-6xl mb-4"
              >
                🗑️
              </motion.div>
              <p className="text-2xl font-black text-white">
                GPS Verisi Silindi
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Oturum sonlandı — Sıfır iz
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route loading overlay — clean light style */}
      <AnimatePresence>
        {routeLoading && (
          <motion.div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-ocid="live_map.loading_state"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 1,
                ease: "linear",
              }}
              className="text-5xl mb-5"
            >
              🗺️
            </motion.div>
            <p className="text-sm font-semibold" style={{ color: "#276EF1" }}>
              Rota hesaplanıyor...
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Gerçek yol verisi alınıyor
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{
          filter: panicMode ? "blur(20px) brightness(0.3)" : "none",
          transition: "filter 0.35s ease",
          paddingBottom: "200px",
        }}
      />

      {/* Panic mode overlay */}
      <AnimatePresence>
        {panicMode && (
          <motion.div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
            }}
            data-ocid="live_map.panic.modal"
          >
            <div
              className="bg-white rounded-3xl shadow-2xl px-8 py-8 mx-6 text-center"
              style={{ maxWidth: 360 }}
            >
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4 }}
                className="text-6xl mb-4"
              >
                👻
              </motion.div>
              <h2 className="text-xl font-black text-gray-900 mb-1">
                Konum Gizlendi
              </h2>
              <p
                className="text-sm font-semibold mb-2"
                style={{ color: "#E11900" }}
              >
                Ghost Mode Aktif
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Konumunuz gizlendi. Sürücü koordinatlarınızı göremez.
              </p>
              <button
                type="button"
                onClick={handleResumeTracking}
                className="w-full py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
                style={{
                  border: "1.5px solid #276EF1",
                  color: "#276EF1",
                  background: "#EBF2FE",
                }}
                data-ocid="live_map.resume_tracking.button"
              >
                Takibi Sürdür
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR — floating over map */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-2 pointer-events-none">
        {/* Back button */}
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else window.history.back();
          }}
          className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-white shadow-lg transition-all active:scale-90"
          style={{ color: "#141414" }}
          data-ocid="live_map.back.button"
        >
          <svg
            role="img"
            aria-label="Geri"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        {/* Phase status pill */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none px-4 py-1.5 rounded-full shadow-lg text-sm font-semibold"
          style={{ background: badgeStyle.bg, color: badgeStyle.text }}
          data-ocid="live_map.session.panel"
        >
          {panicMode ? "👻 Ghost Mode" : PHASE_LABELS[phase]}
        </motion.div>

        {/* ETA pill */}
        <div
          className="pointer-events-none px-4 py-1.5 rounded-full bg-white shadow-lg text-sm font-bold"
          style={{ color: "#141414" }}
          data-ocid="live_map.eta.panel"
        >
          {osrmDuration !== null ? formatEta(etaCountdown) : "— dk"}
        </div>
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <motion.div
          className="rounded-t-3xl shadow-2xl overflow-hidden"
          style={{ background: "#FFFFFF" }}
          layout
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="px-4 pb-6 pt-2">
            {/* Driver row */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "#F6F6F6", border: "1.5px solid #E5E7EB" }}
              >
                👻
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-base"
                  style={{ color: "#141414" }}
                >
                  Ghost Rider
                </p>
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  ⭐ 4.9 · {SESSION_ID}
                </p>
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background: badgeStyle.bg, color: badgeStyle.text }}
              >
                {PHASE_ORDER.indexOf(phase) + 1}/6
              </div>
            </div>

            <div className="border-b" style={{ borderColor: "#F3F4F6" }} />

            {/* Progress bar */}
            <div className="mt-3 mb-3">
              <div
                className="h-1 w-full rounded-full"
                style={{ background: "#E5E7EB" }}
              >
                <motion.div
                  className="h-1 rounded-full"
                  style={{ background: "#276EF1" }}
                  animate={{ width: `${phaseProgress}%` }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center mb-3">
              <div className="flex-1 text-center">
                <p
                  className="text-xs uppercase tracking-wide"
                  style={{ color: "#9CA3AF" }}
                >
                  ETA
                </p>
                <p className="text-lg font-bold" style={{ color: "#276EF1" }}>
                  {osrmDuration !== null ? formatEta(etaCountdown) : "—"}
                </p>
              </div>
              <div className="w-px h-10" style={{ background: "#E5E7EB" }} />
              <div className="flex-1 text-center">
                <p
                  className="text-xs uppercase tracking-wide"
                  style={{ color: "#9CA3AF" }}
                >
                  Mesafe
                </p>
                <p className="text-lg font-bold" style={{ color: "#141414" }}>
                  {osrmDistance !== null ? formatDist(osrmDistance) : "—"}
                </p>
              </div>
              <div className="w-px h-10" style={{ background: "#E5E7EB" }} />
              <div className="flex-1 text-center">
                <p
                  className="text-xs uppercase tracking-wide"
                  style={{ color: "#9CA3AF" }}
                >
                  Ücret
                </p>
                <p className="text-lg font-bold" style={{ color: "#141414" }}>
                  {osrmDistance !== null
                    ? `₺${Math.round((osrmDistance / 1000) * 12 + 15)}`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="border-b mb-3" style={{ borderColor: "#F3F4F6" }} />

            {/* Route strip */}
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-3"
              style={{ background: "#F9FAFB" }}
            >
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#05944F" }}
                />
                <div
                  className="w-0.5 h-5 rounded-full"
                  style={{ background: "#E5E7EB" }}
                />
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#276EF1" }}
                />
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <p className="text-sm truncate" style={{ color: "#374151" }}>
                  Sultanahmet — Alış noktası
                </p>
                <p className="text-sm truncate" style={{ color: "#374151" }}>
                  Taksim Meydanı — Hedef
                </p>
              </div>
            </div>

            {/* Arrived banner */}
            <AnimatePresence>
              {phase === "ARRIVED_PICKUP" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-3"
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                  }}
                >
                  <span className="text-2xl">🚗</span>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#166534" }}
                  >
                    Sürücü alım noktasında bekliyor
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Completed banner */}
            <AnimatePresence>
              {phase === "COMPLETED" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-3"
                  style={{
                    background: "#F5F3FF",
                    border: "1px solid #DDD6FE",
                  }}
                >
                  <span className="text-2xl">🏁</span>
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#5B21B6" }}
                    >
                      Yolculuk tamamlandı
                    </p>
                    <p className="text-xs" style={{ color: "#7C3AED" }}>
                      Nakit ödeme · Veriler silindi
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex gap-2">
              {!panicMode ? (
                <button
                  type="button"
                  onClick={handlePanic}
                  className="flex-1 py-4 rounded-2xl text-base font-semibold transition-all active:scale-95"
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#DC2626",
                  }}
                  data-ocid="live_map.panic.button"
                >
                  🚨 Panik Modu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResumeTracking}
                  className="flex-1 py-4 rounded-2xl text-base font-semibold transition-all active:scale-95"
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    color: "#15803D",
                  }}
                  data-ocid="live_map.resume_tracking.button"
                >
                  ▶ Takibi Sürdür
                </button>
              )}
              <button
                type="button"
                onClick={handleExit}
                className="px-5 py-4 rounded-2xl text-sm font-medium transition-all active:scale-95"
                style={{
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  color: "#9CA3AF",
                }}
                data-ocid="live_map.exit.button"
              >
                Çıkış
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
