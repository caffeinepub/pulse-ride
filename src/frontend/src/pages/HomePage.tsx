import { Switch } from "@/components/ui/switch";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  CheckCircle,
  MapPin,
  MessageCircle,
  Package,
  Radio,
  Search,
  Shield,
  Siren,
  Truck,
  Zap,
} from "lucide-react";
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
  onGhostDelivery?: () => void;
}

function generateSessionId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "GHOST-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateGhostId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "GHOST-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function calcDistance(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
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

type DeliveryStep =
  | "create"
  | "pricing"
  | "matching"
  | "tracking"
  | "code"
  | "summary";
type PackageType = "small" | "medium" | "sensitive";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (display: string, lat: number, lng: number) => void;
  isDark: boolean;
}

function AddressInput({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  isDark,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (v: string) => {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length < 3) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=5&accept-language=tr,en&countrycodes=tr,de,fr,nl,gb,be`,
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="mb-3">
      <p
        className="block text-xs font-semibold mb-1"
        style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
      >
        {label}
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          background: isDark ? "#1F2937" : "#F6F6F6",
          color: isDark ? "#F9FAFB" : "#141414",
          border: `1.5px solid ${isDark ? "#374151" : "#E5E7EB"}`,
        }}
        data-ocid="delivery.address.input"
      />
      {loading && (
        <p className="text-xs mt-1" style={{ color: "#276EF1" }}>
          Aranıyor...
        </p>
      )}
      {suggestions.length > 0 && (
        <div
          className="rounded-xl mt-1 overflow-hidden shadow-lg z-10 relative"
          style={{
            background: isDark ? "#1F2937" : "#fff",
            border: `1px solid ${isDark ? "#374151" : "#E5E7EB"}`,
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.display_name}
              type="button"
              onClick={() => {
                onSelect(
                  s.display_name,
                  Number.parseFloat(s.lat),
                  Number.parseFloat(s.lon),
                );
                setSuggestions([]);
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors hover:opacity-75 border-b last:border-b-0"
              style={{
                color: isDark ? "#F9FAFB" : "#141414",
                borderColor: isDark ? "#374151" : "#E5E7EB",
              }}
            >
              <MapPin
                className="inline w-3 h-3 mr-1"
                style={{ color: "#276EF1" }}
              />
              {s.display_name.length > 55
                ? `${s.display_name.slice(0, 55)}...`
                : s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryMatchingStep({
  courierId,
  textPrimary,
  textSecondary,
  cardBg,
  borderColor,
  onMatched,
}: {
  courierId: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderColor: string;
  onMatched: () => void;
}) {
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMatched(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      key="matching"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center py-4"
    >
      <div className="my-5 relative flex items-center justify-center">
        {!matched ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
              className="absolute w-20 h-20 rounded-full"
              style={{ background: "rgba(39,110,241,0.2)" }}
            />
            <motion.div
              animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0.05, 0.4] }}
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 2,
                delay: 0.3,
              }}
              className="absolute w-20 h-20 rounded-full"
              style={{ background: "rgba(39,110,241,0.15)" }}
            />
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center relative z-10"
              style={{ background: "rgba(39,110,241,0.12)" }}
            >
              <Truck className="w-6 h-6" style={{ color: "#276EF1" }} />
            </div>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.12)" }}
          >
            <CheckCircle className="w-7 h-7" style={{ color: "#10B981" }} />
          </motion.div>
        )}
      </div>

      {!matched ? (
        <>
          <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>
            Kurye Aranıyor...
          </p>
          <p
            className="text-xs text-center mb-4"
            style={{ color: textSecondary }}
          >
            Yakındaki kuryeler anonim olarak bildirildi
          </p>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [-4, 4, -4] }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 1.2,
                  delay: i * 0.2,
                }}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#276EF1" }}
              />
            ))}
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <p
            className="text-base font-black text-center mb-1"
            style={{ color: "#10B981" }}
          >
            KURYE EŞLEŞTİ! ✅
          </p>
          <p
            className="text-xs text-center mb-4"
            style={{ color: textSecondary }}
          >
            Anonim kurye hazır
          </p>
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: cardBg, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                style={{ background: "rgba(39,110,241,0.12)" }}
              >
                👻
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: textPrimary }}>
                  {courierId}
                </p>
                <p className="text-xs" style={{ color: textSecondary }}>
                  Anonim Kurye
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: "rgba(16,185,129,0.1)",
                color: "#10B981",
              }}
            >
              <Shield className="w-3 h-3" />
              Güvenilir · 12 başarılı teslimat
            </div>
          </div>
          <button
            type="button"
            onClick={onMatched}
            className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90"
            style={{ background: "#276EF1" }}
            data-ocid="delivery.start_tracking.button"
          >
            TAKİBE BAŞLA 🗺️
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

const CHIPS = [
  { label: "Chat", icon: MessageCircle, key: "ghostChat" },
  { label: "Comm", icon: Radio, key: "secureComm" },
  { label: "Viral", icon: Zap, key: "viralMode" },
  { label: "Alarm", icon: Siren, key: "ghostAlarm" },
];

const DELIVERY_STEPS: DeliveryStep[] = [
  "create",
  "pricing",
  "matching",
  "tracking",
  "code",
  "summary",
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
  const [role, setRole] = useState<"rider" | "driver" | "delivery">("rider");
  const [driverOnline, setDriverOnline] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [dark, setDark] = useDarkMode();

  // Delivery state
  const [dStep, setDStep] = useState<DeliveryStep>("create");
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [pickupCoord, setPickupCoord] = useState<[number, number] | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<[number, number] | null>(
    null,
  );
  const [packageType, setPackageType] = useState<PackageType>("small");
  const [expressMode, setExpressMode] = useState(false);
  const [courierId] = useState(() => generateGhostId());
  const [deliveryCode] = useState(() => generateCode());
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackProgress, setTrackProgress] = useState(0);
  const [showCodeBtn, setShowCodeBtn] = useState(false);
  const [startTime] = useState(() => Date.now());
  const deliveryMapRef = useRef<HTMLDivElement>(null);
  const deliveryMapInstanceRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);

  // Computed pricing
  const distance =
    pickupCoord && dropoffCoord ? calcDistance(pickupCoord, dropoffCoord) : 0;
  const riskLabel =
    packageType === "sensitive"
      ? "Yüksek"
      : packageType === "medium"
        ? "Orta"
        : "Düşük";
  const riskColor =
    packageType === "sensitive"
      ? "#EF4444"
      : packageType === "medium"
        ? "#F59E0B"
        : "#10B981";
  const basePrice = 15 + distance * 2;
  const finalPrice = expressMode ? basePrice * 1.8 : basePrice;
  const eta = Math.ceil(distance * 3 + 5);
  const tokens = expressMode ? 10 : 5;
  const duration = Math.ceil((Date.now() - startTime) / 60000);

  const isDark = dark;
  const textPrimary = isDark ? "#F9FAFB" : "#141414";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const cardBg = isDark ? "#1F2937" : "#FFFFFF";
  const borderColor = isDark ? "#374151" : "#E5E7EB";

  // Background map
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

  // Delivery tracking map
  useEffect(() => {
    if (dStep !== "tracking" || !pickupCoord || !dropoffCoord) return;
    if (!deliveryMapRef.current) return;

    ensureLeaflet().then(() => {
      const L = (window as any).L;
      if (!L || !deliveryMapRef.current) return;

      if (deliveryMapInstanceRef.current) {
        deliveryMapInstanceRef.current.remove();
        deliveryMapInstanceRef.current = null;
      }

      const map = L.map(deliveryMapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 20 },
      ).addTo(map);

      const bounds = L.latLngBounds([pickupCoord, dropoffCoord]);
      map.fitBounds(bounds, { padding: [30, 30] });

      const greenIcon = L.divIcon({
        html: `<div style="background:#10B981;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">A</div>`,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const blueIcon = L.divIcon({
        html: `<div style="background:#276EF1;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">B</div>`,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const truckIcon = L.divIcon({
        html: `<div style="font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚚</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker(pickupCoord, { icon: greenIcon }).addTo(map);
      L.marker(dropoffCoord, { icon: blueIcon }).addTo(map);
      L.polyline([pickupCoord, dropoffCoord], {
        color: "#141414",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);

      const vehicle = L.marker(pickupCoord, { icon: truckIcon }).addTo(map);
      vehicleMarkerRef.current = vehicle;
      deliveryMapInstanceRef.current = map;

      const DURATION = 30000;
      animStartRef.current = null;
      const animate = (ts: number) => {
        if (!animStartRef.current) animStartRef.current = ts;
        const elapsed = ts - animStartRef.current;
        const t = Math.min(elapsed / DURATION, 1);
        setTrackProgress(t);
        if (t >= 0.7) setShowCodeBtn(true);
        const lat = pickupCoord[0] + (dropoffCoord[0] - pickupCoord[0]) * t;
        const lng = pickupCoord[1] + (dropoffCoord[1] - pickupCoord[1]) * t;
        vehicle.setLatLng([lat, lng]);
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (deliveryMapInstanceRef.current) {
        deliveryMapInstanceRef.current.remove();
        deliveryMapInstanceRef.current = null;
      }
    };
  }, [dStep, pickupCoord, dropoffCoord]);

  const handleChipClick = (key: string) => {
    if (key === "ghostChat") onGhostChat();
    else if (key === "secureComm") onSecureComm();
    else if (key === "ghostAlarm" && onGhostAlarm) onGhostAlarm();
    else if (key === "viralMode") onViralMode();
  };

  const resetDelivery = () => {
    setDStep("create");
    setPickupText("");
    setDropoffText("");
    setPickupCoord(null);
    setDropoffCoord(null);
    setCodeInput("");
    setCodeError(false);
    setRating(0);
    setTrackProgress(0);
    setShowCodeBtn(false);
  };

  const PACKAGE_TYPES: {
    id: PackageType;
    emoji: string;
    label: string;
    desc: string;
  }[] = [
    { id: "small", emoji: "📦", label: "Küçük", desc: "< 2 kg" },
    { id: "medium", emoji: "📫", label: "Orta", desc: "2–10 kg" },
    { id: "sensitive", emoji: "🔒", label: "Hassas", desc: "Kırılabilir" },
  ];

  const panelBg = isDark ? "#111827" : "#FFFFFF";
  const panelStyle = {
    background: panelBg,
    boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
    paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: isDark ? "#111827" : "#F9FAFB" }}
      data-ocid="home.page"
    >
      {/* Full-screen map */}
      <div ref={mapRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ───── TOP BAR ───── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2.5"
        style={{
          background: isDark ? "rgba(17,24,39,0.95)" : "rgba(255,255,255,0.97)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
        }}
        data-ocid="home.topbar.panel"
      >
        {/* Logo */}
        <span
          className="font-black text-sm tracking-tight flex-shrink-0"
          style={{ color: isDark ? "#F9FAFB" : "#141414" }}
        >
          PULSE<span style={{ color: "#276EF1" }}>RIDE</span>
        </span>

        {/* Role pill — 3 options */}
        <div
          className="flex items-center rounded-full p-0.5 ml-1"
          style={{ background: isDark ? "#1F2937" : "#F3F5F7" }}
          data-ocid="home.role.toggle"
        >
          <button
            type="button"
            onClick={() => setRole("rider")}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background: role === "rider" ? "#276EF1" : "transparent",
              color: role === "rider" ? "#fff" : isDark ? "#9CA3AF" : "#6B7280",
            }}
            data-ocid="home.rider.tab"
          >
            Yolcu
          </button>
          <button
            type="button"
            onClick={() => setRole("driver")}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background: role === "driver" ? "#141414" : "transparent",
              color:
                role === "driver" ? "#fff" : isDark ? "#9CA3AF" : "#6B7280",
            }}
            data-ocid="home.driver.tab"
          >
            Şöfür
          </button>
          <button
            type="button"
            onClick={() => setRole("delivery")}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background: role === "delivery" ? "#F59E0B" : "transparent",
              color:
                role === "delivery" ? "#fff" : isDark ? "#9CA3AF" : "#6B7280",
            }}
            data-ocid="home.delivery.tab"
          >
            📦 Teslimat
          </button>
        </div>

        <div className="flex-1" />

        {/* Session badge */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: isDark ? "#1F2937" : "#F3F5F7" }}
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
        <button
          type="button"
          onClick={() => setDark(!dark)}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: isDark ? "#374151" : "#F3F5F7" }}
          data-ocid="home.darkmode.toggle"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* ───── BOTTOM SHEET ───── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl"
        style={panelStyle}
        data-ocid="home.bottom.panel"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-8 h-1 rounded-full"
            style={{ background: isDark ? "#374151" : "#E5E7EB" }}
          />
        </div>

        <AnimatePresence mode="wait">
          {/* ── RIDER ── */}
          {role === "rider" && (
            <motion.div
              key="rider"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="px-4 pt-1 pb-4"
            >
              <button
                type="button"
                onClick={() => onStartRider(sessionId)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-3 text-left"
                style={{ background: isDark ? "#1F2937" : "#F6F6F6" }}
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

              <div className="grid grid-cols-4 gap-2 mb-3">
                {CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleChipClick(chip.key)}
                      className="flex flex-col items-center gap-1 py-2 rounded-xl transition-colors"
                      style={{ background: isDark ? "#1F2937" : "#F6F6F6" }}
                      data-ocid={`home.${chip.key}.button`}
                    >
                      <Icon className="w-4 h-4" style={{ color: "#276EF1" }} />
                      <span
                        className="text-xs font-medium"
                        style={{ color: textPrimary }}
                      >
                        {chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                style={{ background: isDark ? "#1E3A5F" : "#EBF2FE" }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: 1.5,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#276EF1" }}
                  />
                </motion.div>
                <p className="text-xs font-medium" style={{ color: "#276EF1" }}>
                  3 sürücü yakında · Ortalama 4 dk
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartRider(sessionId)}
                className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 active:opacity-75"
                style={{ background: "#276EF1" }}
                data-ocid="home.rider.primary_button"
              >
                Yolculuğu Başlat
              </button>
            </motion.div>
          )}

          {/* ── DRIVER ── */}
          {role === "driver" && (
            <motion.div
              key="driver"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="px-4 pt-1 pb-4"
            >
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl mb-3"
                style={{
                  background: driverOnline
                    ? isDark
                      ? "rgba(5,148,79,0.1)"
                      : "rgba(5,148,79,0.06)"
                    : isDark
                      ? "#1F2937"
                      : "#F6F6F6",
                }}
              >
                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{
                      color: driverOnline ? "#05944F" : textPrimary,
                    }}
                  >
                    {driverOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: textSecondary }}
                  >
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

              <div className="grid grid-cols-4 gap-2 mb-3">
                {CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleChipClick(chip.key)}
                      className="flex flex-col items-center gap-1 py-2 rounded-xl transition-colors"
                      style={{ background: isDark ? "#1F2937" : "#F6F6F6" }}
                      data-ocid={`home.driver.${chip.key}.button`}
                    >
                      <Icon className="w-4 h-4" style={{ color: "#276EF1" }} />
                      <span
                        className="text-xs font-medium"
                        style={{ color: textPrimary }}
                      >
                        {chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {driverOnline && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                  style={{ background: isDark ? "#14532D" : "#F0FDF4" }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Number.POSITIVE_INFINITY,
                      duration: 2,
                      ease: "linear",
                    }}
                  >
                    <div className="text-sm">🔍</div>
                  </motion.div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "#15803D" }}
                  >
                    Yolcu aranıyor... 2 aktif talep
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => onStartDriver(sessionId)}
                className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 active:opacity-75"
                style={{ background: "#141414" }}
                data-ocid="home.driver.primary_button"
              >
                Şöfür Olarak Başla
              </button>
            </motion.div>
          )}

          {/* ── DELIVERY ── */}
          {role === "delivery" && (
            <motion.div
              key="delivery"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              style={{ maxHeight: "72vh", overflowY: "auto" }}
            >
              {/* Step progress bar */}
              <div className="flex gap-1 px-4 pt-2 pb-2">
                {DELIVERY_STEPS.map((s, i) => (
                  <div
                    key={s}
                    className="flex-1 h-1 rounded-full transition-all duration-500"
                    style={{
                      background:
                        DELIVERY_STEPS.indexOf(dStep) >= i
                          ? "#F59E0B"
                          : isDark
                            ? "#374151"
                            : "#E5E7EB",
                    }}
                  />
                ))}
              </div>

              {/* Step header */}
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: "#F59E0B" }} />
                  <span
                    className="text-sm font-bold"
                    style={{ color: textPrimary }}
                  >
                    GHOST DELIVERY
                  </span>
                </div>
                <div
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    color: "#F59E0B",
                  }}
                >
                  {DELIVERY_STEPS.indexOf(dStep) + 1}/6
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* STEP 1: CREATE */}
                {dStep === "create" && (
                  <motion.div
                    key="create"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <p
                      className="text-xs font-semibold mb-3"
                      style={{ color: textSecondary }}
                    >
                      Teslimat Bilgileri
                    </p>

                    <AddressInput
                      label="Alış Noktası (A)"
                      placeholder="Nereden alınacak?"
                      value={pickupText}
                      onChange={setPickupText}
                      onSelect={(d, lat, lng) => {
                        setPickupText(d);
                        setPickupCoord([lat, lng]);
                      }}
                      isDark={isDark}
                    />
                    <AddressInput
                      label="Teslim Noktası (B)"
                      placeholder="Nereye teslim edilecek?"
                      value={dropoffText}
                      onChange={setDropoffText}
                      onSelect={(d, lat, lng) => {
                        setDropoffText(d);
                        setDropoffCoord([lat, lng]);
                      }}
                      isDark={isDark}
                    />

                    {/* Package type */}
                    <p
                      className="text-xs font-semibold mb-2"
                      style={{ color: textSecondary }}
                    >
                      Paket Türü
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {PACKAGE_TYPES.map((pt) => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => setPackageType(pt.id)}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all"
                          style={{
                            background:
                              packageType === pt.id
                                ? "rgba(245,158,11,0.1)"
                                : isDark
                                  ? "#1F2937"
                                  : "#F6F6F6",
                            borderColor:
                              packageType === pt.id ? "#F59E0B" : "transparent",
                          }}
                          data-ocid={`delivery.${pt.id}.button`}
                        >
                          <span className="text-lg">{pt.emoji}</span>
                          <span
                            className="text-xs font-bold"
                            style={{
                              color:
                                packageType === pt.id ? "#F59E0B" : textPrimary,
                            }}
                          >
                            {pt.label}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: textSecondary }}
                          >
                            {pt.desc}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Express toggle */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
                      style={{
                        background: expressMode
                          ? "rgba(245,158,11,0.1)"
                          : isDark
                            ? "#1F2937"
                            : "#F6F6F6",
                        border: `1.5px solid ${
                          expressMode ? "#F59E0B" : "transparent"
                        }`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Zap
                          className="w-4 h-4"
                          style={{ color: expressMode ? "#F59E0B" : "#9CA3AF" }}
                        />
                        <div>
                          <p
                            className="text-xs font-bold"
                            style={{
                              color: expressMode ? "#F59E0B" : textPrimary,
                            }}
                          >
                            Express Mod
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: textSecondary }}
                          >
                            x1.8 ücret · +10 token
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={expressMode}
                        onCheckedChange={setExpressMode}
                        data-ocid="delivery.express.switch"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (pickupCoord && dropoffCoord) setDStep("pricing");
                      }}
                      disabled={!pickupCoord || !dropoffCoord}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity"
                      style={{
                        background:
                          pickupCoord && dropoffCoord ? "#F59E0B" : "#9CA3AF",
                      }}
                      data-ocid="delivery.pricing.primary_button"
                    >
                      FİYAT HESAPLA
                    </button>
                  </motion.div>
                )}

                {/* STEP 2: PRICING */}
                {dStep === "pricing" && (
                  <motion.div
                    key="pricing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <p
                      className="font-bold text-sm mb-3"
                      style={{ color: textPrimary }}
                    >
                      AI Fiyat Analizi
                    </p>

                    <div
                      className="rounded-2xl overflow-hidden mb-3"
                      style={{
                        background: cardBg,
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      {[
                        {
                          label: "Mesafe",
                          value: `${distance.toFixed(1)} km`,
                        },
                        { label: "Tahmini Süre", value: `~${eta} dk` },
                        {
                          label: "Risk",
                          value: riskLabel,
                          valueColor: riskColor,
                        },
                        {
                          label: "Mod",
                          value: expressMode ? "⚡ Express" : "🐢 Normal",
                          valueColor: expressMode ? "#F59E0B" : "#10B981",
                        },
                        {
                          label: "Token",
                          value: `+${tokens} 🪙`,
                          valueColor: "#276EF1",
                        },
                      ].map((row, idx, arr) => (
                        <div
                          key={row.label}
                          className="px-4 py-2.5 flex items-center justify-between"
                          style={{
                            borderBottom:
                              idx < arr.length - 1
                                ? `1px solid ${borderColor}`
                                : undefined,
                          }}
                        >
                          <span
                            className="text-xs"
                            style={{ color: textSecondary }}
                          >
                            {row.label}
                          </span>
                          <span
                            className="text-xs font-bold"
                            style={{ color: row.valueColor ?? textPrimary }}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      className="rounded-2xl p-4 mb-3 flex items-center justify-between"
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1.5px solid #F59E0B",
                      }}
                    >
                      <div>
                        <p
                          className="text-xs font-medium mb-0.5"
                          style={{ color: "#F59E0B" }}
                        >
                          AI Önerilen Fiyat
                        </p>
                        <p
                          className="text-2xl font-black"
                          style={{ color: textPrimary }}
                        >
                          ₺{finalPrice.toFixed(0)}
                        </p>
                        {expressMode && (
                          <p className="text-xs" style={{ color: "#F59E0B" }}>
                            Temel: ₺{basePrice.toFixed(0)} × 1.8
                          </p>
                        )}
                      </div>
                      <div className="text-3xl">💰</div>
                    </div>

                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                      style={{ background: isDark ? "#1F2937" : "#F0FDF4" }}
                    >
                      <Shield
                        className="w-3 h-3"
                        style={{ color: "#10B981" }}
                      />
                      <p
                        className="text-xs"
                        style={{
                          color: isDark ? "#34D399" : "#15803D",
                        }}
                      >
                        Nakit ödeme · Kişisel veri yok
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDStep("matching")}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 mb-2"
                      style={{ background: "#F59E0B" }}
                      data-ocid="delivery.confirm.primary_button"
                    >
                      ONAYLA & KURYE BUL
                    </button>
                    <button
                      type="button"
                      onClick={() => setDStep("create")}
                      className="w-full py-2 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: textSecondary }}
                      data-ocid="delivery.back_to_create.button"
                    >
                      GERİ
                    </button>
                  </motion.div>
                )}

                {/* STEP 3: MATCHING */}
                {dStep === "matching" && (
                  <div className="px-4 pb-4">
                    <DeliveryMatchingStep
                      courierId={courierId}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      cardBg={cardBg}
                      borderColor={borderColor}
                      onMatched={() => setDStep("tracking")}
                    />
                  </div>
                )}

                {/* STEP 4: TRACKING */}
                {dStep === "tracking" && (
                  <motion.div
                    key="tracking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    {/* Inline map */}
                    <div
                      className="relative rounded-2xl overflow-hidden mb-3"
                      style={{ height: 220 }}
                    >
                      <div ref={deliveryMapRef} className="w-full h-full" />
                      {/* ETA badge */}
                      <div
                        className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg z-10"
                        style={{ background: "#141414" }}
                      >
                        🚚 ~{Math.ceil(eta * (1 - trackProgress))} dk kaldı
                      </div>
                      {/* Progress bar */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1"
                        style={{
                          background: isDark ? "#374151" : "#E5E7EB",
                        }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${trackProgress * 100}%`,
                            background: "#F59E0B",
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p
                          className="text-xs font-medium"
                          style={{ color: textSecondary }}
                        >
                          Kurye
                        </p>
                        <p
                          className="font-bold text-sm"
                          style={{ color: textPrimary }}
                        >
                          {courierId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-xs font-medium"
                          style={{ color: textSecondary }}
                        >
                          Paket
                        </p>
                        <p
                          className="font-bold text-sm"
                          style={{ color: textPrimary }}
                        >
                          {packageType === "small"
                            ? "📦 Küçük"
                            : packageType === "medium"
                              ? "📫 Orta"
                              : "🔒 Hassas"}
                        </p>
                      </div>
                    </div>

                    {showCodeBtn ? (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        type="button"
                        onClick={() => setDStep("code")}
                        className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide"
                        style={{ background: "#F59E0B" }}
                        data-ocid="delivery.show_code.button"
                      >
                        TESLİMAT KODU GÖSTER
                      </motion.button>
                    ) : (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{
                          background: isDark ? "#374151" : "#F6F6F6",
                        }}
                      >
                        <motion.div
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{
                            repeat: Number.POSITIVE_INFINITY,
                            duration: 1.5,
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#F59E0B" }}
                          />
                        </motion.div>
                        <p
                          className="text-xs font-medium"
                          style={{ color: textSecondary }}
                        >
                          Kurye yolda...
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 5: CODE */}
                {dStep === "code" && (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <p
                      className="font-bold text-sm mb-1"
                      style={{ color: textPrimary }}
                    >
                      Teslimat Kodu
                    </p>
                    <p
                      className="text-xs mb-4"
                      style={{ color: textSecondary }}
                    >
                      Bu tek kullanımlık kodu alıcıya verin
                    </p>

                    <div
                      className="rounded-2xl p-4 flex flex-col items-center mb-4"
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "2px dashed #F59E0B",
                      }}
                    >
                      <p
                        className="text-xs font-medium mb-2"
                        style={{ color: "#F59E0B" }}
                      >
                        TEK KULLANIMLIK KOD
                      </p>
                      <div className="flex gap-1.5">
                        {deliveryCode.split("").map((digit, i) => (
                          <div
                            key={String.fromCharCode(65 + i)}
                            className="w-9 h-10 flex items-center justify-center rounded-xl text-xl font-black"
                            style={{
                              background: cardBg,
                              color: textPrimary,
                              boxShadow: "0 2px 8px rgba(245,158,11,0.2)",
                            }}
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p
                        className="block text-xs font-semibold mb-1"
                        style={{ color: textSecondary }}
                      >
                        Alıcı kodu girin
                      </p>
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => {
                          setCodeInput(e.target.value);
                          setCodeError(false);
                        }}
                        placeholder="6 haneli kod..."
                        maxLength={6}
                        className="w-full px-3 py-2.5 rounded-xl text-center tracking-widest font-bold outline-none"
                        style={{
                          background: isDark ? "#1F2937" : "#F6F6F6",
                          color: codeError ? "#EF4444" : textPrimary,
                          border: `1.5px solid ${
                            codeError ? "#EF4444" : borderColor
                          }`,
                          fontSize: 18,
                        }}
                        data-ocid="delivery.code.input"
                      />
                      {codeError && (
                        <p
                          className="text-xs mt-1 text-red-500"
                          data-ocid="delivery.code.error_state"
                        >
                          Kod eşleşmedi. Tekrar deneyin.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (codeInput === deliveryCode) setDStep("summary");
                        else setCodeError(true);
                      }}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 mb-3"
                      style={{ background: "#F59E0B" }}
                      data-ocid="delivery.complete.submit_button"
                    >
                      TAMAMLA
                    </button>

                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: isDark ? "#1F2937" : "#F0FDF4" }}
                    >
                      <Shield
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: "#10B981" }}
                      />
                      <p
                        className="text-xs"
                        style={{
                          color: isDark ? "#34D399" : "#15803D",
                        }}
                      >
                        Kişisel veri saklanmıyor
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* STEP 6: SUMMARY */}
                {dStep === "summary" && (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-4 pb-4"
                  >
                    <div
                      className="relative overflow-hidden rounded-2xl mb-3 p-4 text-center"
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1.5px solid #F59E0B",
                      }}
                    >
                      <div className="text-3xl mb-1">🎉</div>
                      <p
                        className="font-black text-base"
                        style={{ color: textPrimary }}
                      >
                        Teslimat Tamamlandı!
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: textSecondary }}
                      >
                        Başarıyla teslim edildi
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        {
                          label: "Süre",
                          value: `${Math.max(duration, 1)} dk`,
                          emoji: "⏱️",
                        },
                        {
                          label: "Mesafe",
                          value: `${distance.toFixed(1)} km`,
                          emoji: "📍",
                        },
                        {
                          label: "Token",
                          value: `+${tokens} 🪙`,
                          emoji: "💰",
                        },
                        { label: "Karma", value: "+2 ⬆️", emoji: "✨" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl p-3"
                          style={{
                            background: cardBg,
                            border: `1px solid ${borderColor}`,
                          }}
                        >
                          <p className="text-base mb-0.5">{stat.emoji}</p>
                          <p
                            className="text-sm font-black"
                            style={{ color: textPrimary }}
                          >
                            {stat.value}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: textSecondary }}
                          >
                            {stat.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Anonymous rating */}
                    <div
                      className="rounded-2xl p-3 mb-3"
                      style={{
                        background: cardBg,
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <p
                        className="text-xs font-semibold mb-2"
                        style={{ color: textPrimary }}
                      >
                        Kurye Değerlendirme
                      </p>
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className="text-xl transition-transform hover:scale-110"
                            data-ocid={`delivery.rating.button.${star}`}
                          >
                            {star <= rating ? "⭐" : "☆"}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: textSecondary }}>
                        {courierId} · Anonim
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={resetDelivery}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 mb-2"
                      style={{ background: "#F59E0B" }}
                      data-ocid="delivery.new.primary_button"
                    >
                      YENİ TESLİMAT
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("rider")}
                      className="w-full py-2 rounded-xl text-xs font-medium"
                      style={{ color: textSecondary }}
                      data-ocid="delivery.home.button"
                    >
                      Ana Sayfaya Dön
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
