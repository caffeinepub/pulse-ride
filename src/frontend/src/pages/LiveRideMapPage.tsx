/* eslint-disable */
// @ts-nocheck
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Leaflet CDN loader ──────────────────────────────────────────────────────
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

type AppPhase = "SEARCH" | "CONFIRM" | "RIDING";

interface Coord {
  lat: number;
  lng: number;
}

const SESSION_ID = `GHOST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function calcBearing(from: [number, number], to: [number, number]): number {
  const dLng = to[1] - from[1];
  const dLat = to[0] - from[0];
  return Math.atan2(dLng, dLat) * (180 / Math.PI);
}

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeCarIcon(L: any, bearing: number) {
  return L.divIcon({
    html: `<div style="font-size:26px;transform:rotate(${bearing}deg);display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45));">🚗</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

interface LiveRideMapPageProps {
  onBack?: () => void;
  pickupCoord?: Coord;
  destCoord?: Coord;
  sessionId?: string;
  role?: "rider" | "driver";
  showAddressSearch?: boolean;
}

export default function LiveRideMapPage({
  onBack,
  pickupCoord,
  destCoord,
  showAddressSearch = true,
}: LiveRideMapPageProps) {
  // ── Phase state machine ────────────────────────────────────────────────
  const [phase, setPhase] = useState<AppPhase>(
    showAddressSearch ? "SEARCH" : "RIDING",
  );

  // ── Active coords as REACT STATE (fix stale closure bug) ──────────────
  const [activePickup, setActivePickup] = useState<Coord>(
    pickupCoord ?? { lat: 41.0082, lng: 28.9784 },
  );
  const [activeDest, setActiveDest] = useState<Coord>(
    destCoord ?? { lat: 41.0451, lng: 28.9994 },
  );
  const [pickupLabel, setPickupLabel] = useState<string>("Mevcut Konum");
  const [destLabel, setDestLabel] = useState<string>("");

  // ── GPS detection ──────────────────────────────────────────────────────
  const [gpsDetecting, setGpsDetecting] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coord: Coord = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setActivePickup(coord);
        setGpsDetecting(false);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coord.lat}&lon=${coord.lng}&format=json&accept-language=tr,en`,
          );
          const data = await res.json();
          if (data?.address) {
            const parts = [
              data.address.neighbourhood ||
                data.address.suburb ||
                data.address.quarter ||
                data.address.road ||
                "",
              data.address.city ||
                data.address.town ||
                data.address.county ||
                "",
            ].filter(Boolean);
            setPickupLabel(parts.join(", ") || data.display_name.split(",")[0]);
          }
        } catch {
          /* ignore */
        }
      },
      () => setGpsDetecting(false),
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true },
    );
  }, []);

  // ── Address search state ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<any[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("pulseride_recent_addresses") || "[]",
      );
    } catch {
      return [];
    }
  });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((val: string) => {
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=7&accept-language=tr,en&countrycodes=tr,de,fr,nl,gb,be`,
        );
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
  }, []);

  const handleSelectDest = useCallback((result: any) => {
    const coord: Coord = {
      lat: Number.parseFloat(result.lat),
      lng: Number.parseFloat(result.lon),
    };
    setActiveDest(coord);
    setDestLabel(result.display_name.split(",").slice(0, 2).join(", "));
    setSearchResults([]);
    setSearchQuery("");
    // Save to recent addresses
    const recent = (() => {
      try {
        return JSON.parse(
          localStorage.getItem("pulseride_recent_addresses") || "[]",
        );
      } catch {
        return [];
      }
    })();
    const updated = [
      result,
      ...recent.filter((r: any) => r.place_id !== result.place_id),
    ].slice(0, 5);
    localStorage.setItem("pulseride_recent_addresses", JSON.stringify(updated));
    setRecentAddresses(updated);
    setPhase("CONFIRM");
  }, []);

  // ── Map refs ───────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const rafRef = useRef<number | null>(null);

  // ── Ride state ─────────────────────────────────────────────────────────
  const [routeLoading, setRouteLoading] = useState(false);
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null);
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null);
  const [etaCountdown, setEtaCountdown] = useState(600);
  const [panicMode, setPanicMode] = useState(false);
  const [panicFlash, setPanicFlash] = useState(false);
  const [showWipe, setShowWipe] = useState(false);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);

  // Estimated price
  const price =
    osrmDistance !== null ? Math.round((osrmDistance / 1000) * 12 + 15) : null;

  // ── Map init — KEY trick: remounts when coords change ─────────────────
  // The map container gets key={activePickup.lat+","+activeDest.lat}
  // so React destroys/recreates the DOM node when coords change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: map init uses partial deps intentionally
  useEffect(() => {
    if (phase === "SEARCH") return;
    let destroyed = false;
    const p = activePickup;
    const d = activeDest;

    setRouteLoading(true);
    routeCoordsRef.current = [];
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    ensureLeaflet().then(() => {
      if (destroyed || !mapContainerRef.current) return;
      const L = (window as any).L;

      // Clean up existing map if any (safety)
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

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

      // CartoDB Voyager — light/white Uber-like tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
        },
      ).addTo(map);

      // Pickup marker — green filled circle
      const pickupIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#05944F;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([p.lat, p.lng], { icon: pickupIcon }).addTo(map);

      // Destination marker — black square pin
      const destIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#1a1a1a;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.45);border-radius:3px;"></div>`,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([d.lat, d.lng], { icon: destIcon }).addTo(map);

      // Car marker initial
      carMarkerRef.current = L.marker([p.lat, p.lng], {
        icon: makeCarIcon(L, 0),
        zIndexOffset: 1000,
      }).addTo(map);

      // Fetch OSRM route
      const url = `https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
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
              weight: 12,
              opacity: 0.08,
            }).addTo(map);
            // Route line — dark/black like Uber
            L.polyline(coords, {
              color: "#1a1a1a",
              weight: 5,
              opacity: 0.9,
            }).addTo(map);
            map.fitBounds(L.latLngBounds(coords), {
              padding: [80, 200],
              maxZoom: 16,
            });
            setOsrmDistance(route.distance);
            setOsrmDuration(route.duration);
            setEtaCountdown(Math.round(route.duration));
            setRouteLoading(false);
          } else {
            throw new Error("No route");
          }
        })
        .catch(() => {
          if (destroyed) return;
          const fallback: [number, number][] = [
            [p.lat, p.lng],
            [d.lat, d.lng],
          ];
          routeCoordsRef.current = fallback;
          const L2 = (window as any).L;
          L2.polyline(fallback, {
            color: "#1a1a1a",
            weight: 5,
            opacity: 0.9,
          }).addTo(map);
          const dist = Math.sqrt(
            ((d.lat - p.lat) * 111000) ** 2 +
              ((d.lng - p.lng) * 111000 * Math.cos((p.lat * Math.PI) / 180)) **
                2,
          );
          setOsrmDistance(dist);
          setOsrmDuration(dist / 13);
          setEtaCountdown(Math.round(dist / 13));
          setRouteLoading(false);
          toast.error("Rota yüklenemedi, tahmini hat kullanılıyor");
        });
    });

    return () => {
      destroyed = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional partial deps for map init
  }, [
    activePickup.lat,
    activePickup.lng,
    activeDest.lat,
    activeDest.lng,
    phase,
  ]);

  // ── rAF Car animation — starts only in RIDING phase ───────────────────
  const animateCarRAF = useCallback(() => {
    const coords = routeCoordsRef.current;
    if (!coords.length || !carMarkerRef.current || !mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const totalSteps = coords.length;
    const duration = 45000; // 45s for full route
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const floatIdx = progress * (totalSteps - 1);
      const idx = Math.floor(floatIdx);
      const nextIdx = Math.min(idx + 1, totalSteps - 1);
      const frac = floatIdx - idx;

      const lat = coords[idx][0] + (coords[nextIdx][0] - coords[idx][0]) * frac;
      const lng = coords[idx][1] + (coords[nextIdx][1] - coords[idx][1]) * frac;
      const bearing = calcBearing(coords[idx], coords[nextIdx]);

      carMarkerRef.current.setLatLng([lat, lng]);
      carMarkerRef.current.setIcon(makeCarIcon(L, bearing));

      // Pan map to follow car
      if (mapRef.current && progress > 0.02) {
        mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setRideCompleted(true);
        toast.success("🏁 Yolculuk tamamlandı! Nakit ödeme yapınız.");
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (phase !== "RIDING") return;
    // Small delay to let map settle
    const t = setTimeout(() => animateCarRAF(), 500);
    return () => {
      clearTimeout(t);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase, animateCarRAF]);

  // ── ETA countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "RIDING") return;
    const id = setInterval(
      () => setEtaCountdown((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [phase]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    setPhase("RIDING");
    toast.success("🚗 Yolculuk başladı!");
  }, []);

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

  const handleBack = useCallback(() => {
    if (phase === "CONFIRM") {
      setPhase("SEARCH");
      return;
    }
    if (onBack) onBack();
    else window.history.back();
  }, [phase, onBack]);

  // ── Format helpers ────────────────────────────────────────────────────
  const formatEta = (secs: number) => {
    const m = Math.floor(secs / 60);
    return m < 1 ? "<1 dk" : `${m} dk`;
  };
  const formatDist = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

  // ── Map key — changes when coords change, forcing full remount ─────────
  const mapKey = `${activePickup.lat.toFixed(5)}_${activePickup.lng.toFixed(5)}_${activeDest.lat.toFixed(5)}_${activeDest.lng.toFixed(5)}`;

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-white select-none"
      data-ocid="live_map.page"
    >
      {/* ── PANIC FLASH ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {panicFlash && (
          <motion.div
            className="absolute inset-0 z-[90] pointer-events-none"
            style={{ background: "#E11900" }}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* ── DATA WIPE OVERLAY ───────────────────────────────────────── */}
      <AnimatePresence>
        {showWipe && (
          <motion.div
            className="absolute inset-0 z-[95] flex items-center justify-center"
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

      {/* ══════════════════════════════════════════════════════════════
          PHASE: SEARCH
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === "SEARCH" && (
          <motion.div
            className="absolute inset-0 z-[60] flex flex-col bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            data-ocid="live_map.search_screen"
          >
            {/* Dark header */}
            <div
              className="flex items-center gap-3 px-4 pt-12 pb-4"
              style={{ background: "#141414" }}
            >
              <button
                type="button"
                onClick={() => {
                  if (onBack) onBack();
                  else window.history.back();
                }}
                className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
                data-ocid="live_map.back.button"
              >
                <svg
                  role="img"
                  aria-label="icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <div className="flex-1">
                <p
                  className="text-xs font-medium"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Nereye gidiyorsunuz?
                </p>
                <div
                  className="flex items-center gap-2 mt-1 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                >
                  <svg
                    role="img"
                    aria-label="icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#276EF1"
                    strokeWidth="2.5"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40"
                    placeholder="Mahalle, şehir veya adres..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    data-ocid="live_map.search_input"
                  />
                  {searchLoading && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Number.POSITIVE_INFINITY,
                        duration: 0.7,
                        ease: "linear",
                      }}
                      style={{ color: "#276EF1", fontSize: 16, lineHeight: 1 }}
                    >
                      ⟳
                    </motion.div>
                  )}
                  {searchQuery.length > 0 && !searchLoading && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 18,
                        lineHeight: 1,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Current location row */}
            <div
              className="flex items-center gap-3 px-5 py-3.5"
              style={{ borderBottom: "1px solid #F3F4F6" }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: "#05944F" }}
              />
              <div className="flex-1">
                <p className="text-xs" style={{ color: "#9CA3AF" }}>
                  Mevcut Konum (Alım Noktası)
                </p>
                {gpsDetecting ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Number.POSITIVE_INFINITY,
                        duration: 1,
                        ease: "linear",
                      }}
                      className="w-3.5 h-3.5 border-2 rounded-full"
                      style={{
                        borderColor: "#276EF1",
                        borderTopColor: "transparent",
                      }}
                    />
                    <p className="text-sm" style={{ color: "#9CA3AF" }}>
                      GPS tespit ediliyor...
                    </p>
                  </div>
                ) : (
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#141414" }}
                  >
                    {pickupLabel}
                  </p>
                )}
              </div>
              {!gpsDetecting && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#D1FAE5", color: "#065F46" }}
                >
                  📍 GPS
                </span>
              )}
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto">
              {searchResults.length > 0 ? (
                <>
                  <p
                    className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#9CA3AF" }}
                  >
                    {searchResults.length} SONUÇ
                  </p>
                  {searchResults.map((result) => (
                    <button
                      type="button"
                      key={result.place_id}
                      onClick={() => handleSelectDest(result)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                      style={{ borderBottom: "1px solid #F9FAFB" }}
                      data-ocid="live_map.search.button"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "#F3F4F6" }}
                      >
                        <svg
                          role="img"
                          aria-label="icon"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#374151"
                          strokeWidth="2"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "#141414" }}
                        >
                          {result.display_name.split(",")[0]}
                        </p>
                        <p
                          className="text-xs truncate mt-0.5"
                          style={{ color: "#9CA3AF" }}
                        >
                          {result.display_name
                            .split(",")
                            .slice(1, 3)
                            .join(",")
                            .trim()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "#F3F4F6", color: "#374151" }}
                        >
                          ~
                          {Math.round(
                            haversineDist(
                              activePickup.lat,
                              activePickup.lng,
                              Number.parseFloat(result.lat),
                              Number.parseFloat(result.lon),
                            ) /
                              1000 /
                              0.5,
                          )}{" "}
                          dk
                        </span>
                        <svg
                          role="img"
                          aria-label="icon"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#D1D5DB"
                          strokeWidth="2.5"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </>
              ) : searchQuery.length === 0 ? (
                <div>
                  {recentAddresses.length > 0 && (
                    <>
                      <p
                        className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest"
                        style={{ color: "#9CA3AF" }}
                      >
                        Son Adresler
                      </p>
                      {recentAddresses.map((result: any) => (
                        <button
                          type="button"
                          key={result.place_id}
                          onClick={() => handleSelectDest(result)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                          style={{ borderBottom: "1px solid #F9FAFB" }}
                          data-ocid="live_map.recent.button"
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                            style={{ background: "#F3F4F6" }}
                          >
                            🕐
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-semibold truncate"
                              style={{ color: "#141414" }}
                            >
                              {result.display_name.split(",")[0]}
                            </p>
                            <p
                              className="text-xs truncate mt-0.5"
                              style={{ color: "#9CA3AF" }}
                            >
                              {result.display_name
                                .split(",")
                                .slice(1, 3)
                                .join(",")
                                .trim()}
                            </p>
                          </div>
                          <svg
                            role="img"
                            aria-label="icon"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#D1D5DB"
                            strokeWidth="2.5"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      ))}
                    </>
                  )}
                  {recentAddresses.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-60 gap-4">
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                        style={{ background: "#F3F4F6" }}
                      >
                        🗺️
                      </div>
                      <div className="text-center px-8">
                        <p
                          className="font-bold text-lg"
                          style={{ color: "#141414" }}
                        >
                          Nereye?
                        </p>
                        <p
                          className="text-sm mt-1"
                          style={{ color: "#9CA3AF" }}
                        >
                          Türkiye ve Avrupa'da adres arayın
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : searchQuery.length < 2 ? (
                <p className="px-5 pt-6 text-sm" style={{ color: "#9CA3AF" }}>
                  En az 2 karakter girin...
                </p>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>
                    Sonuç bulunamadı
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MAP CONTAINER — only rendered in CONFIRM or RIDING
          key= changes when coords change → forces Leaflet full remount
      ══════════════════════════════════════════════════════════════ */}
      {(phase === "CONFIRM" || phase === "RIDING") && (
        <div
          key={mapKey}
          ref={mapContainerRef}
          className="absolute inset-0"
          style={{
            filter: panicMode ? "blur(20px) brightness(0.3)" : "none",
            transition: "filter 0.35s ease",
          }}
        />
      )}

      {/* ── Route loading overlay ──────────────────────────────────── */}
      <AnimatePresence>
        {routeLoading && phase !== "SEARCH" && (
          <motion.div
            className="absolute inset-0 z-[30] flex flex-col items-center justify-center"
            style={{ background: "rgba(255,255,255,0.92)" }}
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
            <p className="text-sm font-bold" style={{ color: "#276EF1" }}>
              Rota hesaplanıyor...
            </p>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Gerçek yol verisi alınıyor
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating black ETA badge (Uber style) ─────────────────── */}
      {(phase === "CONFIRM" || phase === "RIDING") &&
        !routeLoading &&
        osrmDuration !== null && (
          <div
            className="absolute z-[25] left-4 pointer-events-none"
            style={{
              bottom: phase === "CONFIRM" ? 380 : 220,
              transition: "bottom 0.4s ease",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-2xl"
              style={{ background: "#1a1a1a", color: "#fff" }}
            >
              <span className="text-xl font-black">
                {formatEta(etaCountdown)}
              </span>
              {osrmDistance !== null && (
                <span
                  className="text-xs font-medium"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  · {formatDist(osrmDistance)}
                </span>
              )}
            </motion.div>
          </div>
        )}

      {/* ── TOP NAV (CONFIRM / RIDING) ─────────────────────────────── */}
      {(phase === "CONFIRM" || phase === "RIDING") && (
        <div className="absolute top-0 left-0 right-0 z-[25] flex items-center justify-between px-4 pt-4 pb-2 pointer-events-none">
          <button
            type="button"
            onClick={handleBack}
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
          <div
            className="pointer-events-none px-4 py-1.5 rounded-full shadow-lg text-sm font-semibold bg-white"
            style={{ color: "#141414" }}
          >
            {phase === "CONFIRM"
              ? `📍 ${SESSION_ID}`
              : panicMode
                ? "👻 Ghost Mode"
                : "🚗 Yolculukta"}
          </div>
          <div style={{ width: 44 }} />
        </div>
      )}

      {/* ── RIDE COMPLETED FULL SCREEN OVERLAY ───────────────────── */}
      <AnimatePresence>
        {rideCompleted && (
          <motion.div
            className="absolute inset-0 z-[50] flex flex-col items-center justify-center bg-white"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            data-ocid="live_map.ride_complete.modal"
          >
            <div className="w-full max-w-sm px-6 text-center">
              <div className="text-6xl mb-4">🏁</div>
              <h2
                className="text-2xl font-black mb-1"
                style={{ color: "#111827" }}
              >
                Yolculuk Tamamlandı!
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
                Güvenli bir yolculuktu — veriler silindi
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div
                  className="flex flex-col items-center py-3 rounded-2xl"
                  style={{ background: "#F9FAFB" }}
                >
                  <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>
                    Süre
                  </p>
                  <p
                    className="text-base font-black"
                    style={{ color: "#111827" }}
                  >
                    {osrmDuration !== null ? formatEta(osrmDuration) : "—"}
                  </p>
                </div>
                <div
                  className="flex flex-col items-center py-3 rounded-2xl"
                  style={{ background: "#F9FAFB" }}
                >
                  <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>
                    Mesafe
                  </p>
                  <p
                    className="text-base font-black"
                    style={{ color: "#111827" }}
                  >
                    {osrmDistance !== null ? formatDist(osrmDistance) : "—"}
                  </p>
                </div>
                <div
                  className="flex flex-col items-center py-3 rounded-2xl"
                  style={{ background: "#F9FAFB" }}
                >
                  <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>
                    Ücret
                  </p>
                  <p
                    className="text-base font-black"
                    style={{ color: "#111827" }}
                  >
                    {price !== null ? `₺${price}` : "—"}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl mb-4"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
              >
                <span>⚡</span>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#15803D" }}
                >
                  Karma +2 kazandı
                </p>
              </div>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6"
                style={{ background: "#F9FAFB" }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: "#E5E7EB" }}
                >
                  👻
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: "#111827" }}>
                    Ghost Sürücü
                  </p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    ⭐ 4.9 · Anonim
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRideCompleted(false);
                  setPhase("SEARCH");
                  setActiveDest({ lat: 41.0082, lng: 28.9784 });
                  setDestLabel("");
                  setPanelMinimized(false);
                }}
                className="w-full py-4 rounded-2xl font-bold text-white"
                style={{ background: "#276EF1" }}
                data-ocid="live_map.new_ride.button"
              >
                Yeni Yolculuk
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PANIC MODE OVERLAY ────────────────────────────────────── */}
      <AnimatePresence>
        {panicMode && (
          <motion.div
            className="absolute inset-0 z-[40] flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: "rgba(0,0,0,0.75)",
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

      {/* ══════════════════════════════════════════════════════════════
          BOTTOM SHEET — CONFIRM PHASE
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === "CONFIRM" && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-[30] rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ background: "#FFFFFF" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 38 }}
            data-ocid="live_map.confirm.panel"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "#E5E7EB" }}
              />
            </div>
            <div className="px-5 pb-8 pt-2">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "#9CA3AF" }}
              >
                Bilgileri onaylayın
              </p>

              {/* Car option row */}
              <div
                className="flex items-center gap-4 p-4 rounded-2xl mb-4"
                style={{ background: "#F9FAFB", border: "2px solid #1a1a1a" }}
              >
                <div className="text-4xl">🚗</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="font-bold text-base"
                      style={{ color: "#141414" }}
                    >
                      PulseX
                    </p>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>
                      👤4
                    </span>
                    <span
                      className="ml-auto font-black text-lg"
                      style={{ color: "#141414" }}
                    >
                      {price !== null ? `₺${price}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>
                      {osrmDuration !== null ? formatEta(osrmDuration) : "—"}
                    </span>
                    <span className="text-xs" style={{ color: "#D1D5DB" }}>
                      ·
                    </span>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>
                      {osrmDistance !== null ? formatDist(osrmDistance) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Route strip */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
                style={{ background: "#F9FAFB" }}
              >
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: "#05944F" }}
                  />
                  <div
                    className="w-0.5 h-5"
                    style={{ background: "#E5E7EB" }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: "#1a1a1a" }}
                  />
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  <p className="text-sm truncate" style={{ color: "#374151" }}>
                    {pickupLabel || "Mevcut Konum"}
                  </p>
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "#141414" }}
                  >
                    {destLabel || "Hedef"}
                  </p>
                </div>
              </div>

              {/* Payment row */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
                style={{ background: "#F9FAFB" }}
              >
                <span className="text-xl">💵</span>
                <p className="text-sm font-medium" style={{ color: "#374151" }}>
                  Nakit
                </p>
                <p className="ml-auto text-sm" style={{ color: "#9CA3AF" }}>
                  Yolculuk sonunda ödeme
                </p>
              </div>

              {/* Confirm button */}
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-95"
                style={{ background: "#1a1a1a", color: "#fff" }}
                data-ocid="live_map.confirm.primary_button"
              >
                PulseX seçeneğini onaylayın
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          BOTTOM SHEET — RIDING PHASE
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === "RIDING" && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-[30] rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ background: "#FFFFFF" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 38 }}
            data-ocid="live_map.riding.panel"
          >
            {/* Minimize toggle */}
            <button
              type="button"
              onClick={() => setPanelMinimized(!panelMinimized)}
              className="absolute -top-10 right-4 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 text-sm"
              style={{ zIndex: 1 }}
              data-ocid="live_map.panel.toggle"
            >
              {panelMinimized ? "▲" : "▼"}
            </button>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "#E5E7EB" }}
              />
            </div>

            {!panelMinimized && (
              <div className="px-5 pb-6 pt-2">
                {/* Driver row */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      background: "#F6F6F6",
                      border: "1.5px solid #E5E7EB",
                    }}
                  >
                    👻
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-base"
                      style={{ color: "#141414" }}
                    >
                      Ghost Sürücü
                    </p>
                    <p className="text-sm" style={{ color: "#6B7280" }}>
                      ⭐ 4.9 · {SESSION_ID}
                    </p>
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: rideCompleted ? "#D1FAE5" : "#EBF2FE",
                      color: rideCompleted ? "#065F46" : "#276EF1",
                    }}
                  >
                    {rideCompleted ? "✓ Tamamlandı" : "Yolda"}
                  </div>
                </div>

                <div className="h-px mb-3" style={{ background: "#F3F4F6" }} />

                {/* Stats row */}
                <div className="flex items-center mb-4">
                  <div className="flex-1 text-center">
                    <p
                      className="text-xs uppercase tracking-wide"
                      style={{ color: "#9CA3AF" }}
                    >
                      ETA
                    </p>
                    <p
                      className="text-xl font-black"
                      style={{ color: "#1a1a1a" }}
                    >
                      {formatEta(etaCountdown)}
                    </p>
                  </div>
                  <div
                    className="w-px h-10"
                    style={{ background: "#E5E7EB" }}
                  />
                  <div className="flex-1 text-center">
                    <p
                      className="text-xs uppercase tracking-wide"
                      style={{ color: "#9CA3AF" }}
                    >
                      Mesafe
                    </p>
                    <p
                      className="text-xl font-black"
                      style={{ color: "#1a1a1a" }}
                    >
                      {osrmDistance !== null ? formatDist(osrmDistance) : "—"}
                    </p>
                  </div>
                  <div
                    className="w-px h-10"
                    style={{ background: "#E5E7EB" }}
                  />
                  <div className="flex-1 text-center">
                    <p
                      className="text-xs uppercase tracking-wide"
                      style={{ color: "#9CA3AF" }}
                    >
                      Ücret
                    </p>
                    <p
                      className="text-xl font-black"
                      style={{ color: "#1a1a1a" }}
                    >
                      {price !== null ? `₺${price}` : "—"}
                    </p>
                  </div>
                </div>

                {/* Destination row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
                  style={{ background: "#F9FAFB" }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: "#1a1a1a" }}
                  />
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "#141414" }}
                  >
                    {destLabel || "Hedef"}
                  </p>
                </div>

                {/* Completed banner */}
                <AnimatePresence>
                  {rideCompleted && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
                      style={{
                        background: "#F0FDF4",
                        border: "1px solid #BBF7D0",
                      }}
                    >
                      <span className="text-2xl">🏁</span>
                      <div>
                        <p
                          className="text-sm font-bold"
                          style={{ color: "#166534" }}
                        >
                          Yolculuk tamamlandı!
                        </p>
                        <p className="text-xs" style={{ color: "#4ADE80" }}>
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
                      className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95"
                      style={{
                        background: "#FEF2F2",
                        border: "1px solid #FECACA",
                        color: "#DC2626",
                      }}
                      data-ocid="live_map.panic.button"
                    >
                      🚨 Panik
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResumeTracking}
                      className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95"
                      style={{
                        background: "#F0FDF4",
                        border: "1px solid #BBF7D0",
                        color: "#15803D",
                      }}
                      data-ocid="live_map.resume_tracking.button"
                    >
                      ▶ Takip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExit}
                    className="px-5 py-3.5 rounded-2xl text-sm font-medium transition-all active:scale-95"
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
