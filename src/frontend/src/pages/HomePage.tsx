import { Switch } from "@/components/ui/switch";
import { MessageCircle, Radio, Search, Shield, Siren, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface HomePageProps {
  onStartRider: (sessionId: string) => void;
  onStartDriver: (sessionId: string) => void;
  onViralMode: () => void;
  onSecureComm: () => void;
  onGhostChat: () => void;
  onGhostGroup: () => void;
  onGhostAlarm?: () => void;
}

function generateSessionId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "GHOST-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

const CHIPS = [
  { label: "Chat", icon: MessageCircle, key: "ghostChat" },
  { label: "Comm", icon: Radio, key: "secureComm" },
  { label: "Viral", icon: Zap, key: "viralMode" },
  { label: "Alarm", icon: Siren, key: "ghostAlarm" },
];

export default function HomePage({
  onStartRider,
  onStartDriver,
  onViralMode,
  onSecureComm,
  onGhostChat,
  onGhostGroup: _onGhostGroup,
  onGhostAlarm,
}: HomePageProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [role, setRole] = useState<"rider" | "driver">("rider");
  const [driverOnline, setDriverOnline] = useState(false);
  const [sessionId] = useState(() => generateSessionId());

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let destroyed = false;

    ensureLeaflet().then(() => {
      if (destroyed || !mapRef.current) return;
      const L = (window as any).L;

      const map = L.map(mapRef.current, {
        center: [41.0082, 28.9784],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 20 },
      ).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleChipClick = (key: string) => {
    if (key === "ghostChat") onGhostChat();
    else if (key === "secureComm") onSecureComm();
    else if (key === "ghostAlarm" && onGhostAlarm) onGhostAlarm();
    else if (key === "viralMode") onViralMode();
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-gray-100"
      data-ocid="home.page"
    >
      {/* Full-screen map */}
      <div ref={mapRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ───── TOP BAR ───── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 bg-white"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.08)" }}
        data-ocid="home.topbar.panel"
      >
        {/* Logo */}
        <span
          className="font-black text-base tracking-tight"
          style={{ color: "#141414" }}
        >
          PULSE<span style={{ color: "#276EF1" }}>RIDE</span>
        </span>

        {/* Role pill */}
        <div
          className="flex items-center rounded-full p-0.5 ml-1"
          style={{ background: "#F3F5F7" }}
          data-ocid="home.role.toggle"
        >
          <button
            type="button"
            onClick={() => setRole("rider")}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150"
            style={{
              background: role === "rider" ? "#276EF1" : "transparent",
              color: role === "rider" ? "#fff" : "#6B7280",
            }}
            data-ocid="home.rider.tab"
          >
            Yolcu
          </button>
          <button
            type="button"
            onClick={() => setRole("driver")}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150"
            style={{
              background: role === "driver" ? "#141414" : "transparent",
              color: role === "driver" ? "#fff" : "#6B7280",
            }}
            data-ocid="home.driver.tab"
          >
            Şöfür
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Session badge */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: "#F3F5F7" }}
          data-ocid="home.session.card"
        >
          <Shield className="w-3 h-3" style={{ color: "#276EF1" }} />
          <span
            className="text-xs font-mono font-bold"
            style={{ color: "#276EF1" }}
          >
            {sessionId}
          </span>
        </div>
      </div>

      {/* ───── BOTTOM SHEET ───── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl bg-white"
        style={{
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        }}
        data-ocid="home.bottom.panel"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>

        <AnimatePresence mode="wait">
          {role === "rider" ? (
            <motion.div
              key="rider"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="px-4 pt-1 pb-4"
            >
              {/* Search bar */}
              <button
                type="button"
                onClick={() => onStartRider(sessionId)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 mb-3 text-left"
                style={{ background: "#F6F6F6" }}
                data-ocid="home.search_input"
              >
                <Search
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "#9CA3AF" }}
                />
                <span className="text-sm flex-1" style={{ color: "#9CA3AF" }}>
                  Nereye gidiyorsunuz?
                </span>
              </button>

              {/* Quick chips */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleChipClick(chip.key)}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-colors"
                      style={{ background: "#F6F6F6" }}
                      data-ocid={`home.${chip.key}.button`}
                    >
                      <Icon className="w-4 h-4" style={{ color: "#276EF1" }} />
                      <span
                        className="text-xs font-medium"
                        style={{ color: "#141414" }}
                      >
                        {chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onStartRider(sessionId)}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 active:opacity-75"
                style={{ background: "#276EF1" }}
                data-ocid="home.rider.primary_button"
              >
                Yolculuğu Başlat
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="driver"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="px-4 pt-1 pb-4"
            >
              {/* Online toggle row */}
              <div
                className="flex items-center justify-between px-4 py-3.5 rounded-xl mb-3"
                style={{
                  background: driverOnline ? "rgba(5,148,79,0.06)" : "#F6F6F6",
                }}
              >
                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: driverOnline ? "#05944F" : "#141414" }}
                  >
                    {driverOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                    {driverOnline
                      ? "Yolcu aramaları alıyorsunuz"
                      : "Çevrimiçi olun"}
                  </p>
                </div>
                <Switch
                  checked={driverOnline}
                  onCheckedChange={setDriverOnline}
                  data-ocid="home.driver.switch"
                />
              </div>

              {/* Quick chips */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleChipClick(chip.key)}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-colors"
                      style={{ background: "#F6F6F6" }}
                      data-ocid={`home.driver.${chip.key}.button`}
                    >
                      <Icon className="w-4 h-4" style={{ color: "#276EF1" }} />
                      <span
                        className="text-xs font-medium"
                        style={{ color: "#141414" }}
                      >
                        {chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onStartDriver(sessionId)}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 active:opacity-75"
                style={{ background: "#141414" }}
                data-ocid="home.driver.primary_button"
              >
                Şöfür Olarak Başla
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
