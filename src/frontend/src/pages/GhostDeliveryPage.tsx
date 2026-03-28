import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  MapPin,
  Package,
  Shield,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Step = "create" | "pricing" | "matching" | "tracking" | "code" | "summary";
type PackageType = "small" | "medium" | "sensitive";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
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
    <div className="mb-4">
      <p
        className="block text-xs font-semibold mb-1.5"
        style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
      >
        {label}
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all"
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
          className="rounded-xl mt-1 overflow-hidden shadow-lg z-10"
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
              className="w-full text-left px-3.5 py-2.5 text-xs transition-colors hover:opacity-75 border-b last:border-b-0"
              style={{
                color: isDark ? "#F9FAFB" : "#141414",
                borderColor: isDark ? "#374151" : "#E5E7EB",
              }}
            >
              <MapPin
                className="inline w-3 h-3 mr-1.5"
                style={{ color: "#276EF1" }}
              />
              {s.display_name.length > 60
                ? `${s.display_name.slice(0, 60)}...`
                : s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface GhostDeliveryPageProps {
  onBack: () => void;
}

export default function GhostDeliveryPage({ onBack }: GhostDeliveryPageProps) {
  const isDark = localStorage.getItem("darkMode") === "true";

  const [step, setStep] = useState<Step>("create");
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
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
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

  // Track animation
  useEffect(() => {
    if (step !== "tracking" || !pickupCoord || !dropoffCoord) return;
    if (!mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Init map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20 },
    ).addTo(map);

    const bounds = L.latLngBounds([pickupCoord, dropoffCoord]);
    map.fitBounds(bounds, { padding: [50, 50] });

    // Markers
    const greenIcon = L.divIcon({
      html: `<div style="background:#10B981;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">A</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const blueIcon = L.divIcon({
      html: `<div style="background:#276EF1;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">B</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const truckIcon = L.divIcon({
      html: `<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚚</div>`,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
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
    mapInstanceRef.current = map;

    // Animate over 30s
    const DURATION = 30000;
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

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [step, pickupCoord, dropoffCoord]);

  const bg = isDark ? "#111827" : "#F9FAFB";
  const cardBg = isDark ? "#1F2937" : "#FFFFFF";
  const textPrimary = isDark ? "#F9FAFB" : "#141414";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const borderColor = isDark ? "#374151" : "#E5E7EB";

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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4 sticky top-0 z-40"
        style={{ background: cardBg, borderBottom: `1px solid ${borderColor}` }}
      >
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
          style={{ background: isDark ? "#374151" : "#F6F6F6" }}
          data-ocid="delivery.back.button"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: textPrimary }} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-base" style={{ color: textPrimary }}>
            📦 GHOST DELIVERY
          </h1>
          <p className="text-xs" style={{ color: textSecondary }}>
            Anonim P2P Teslimat
          </p>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: "rgba(39,110,241,0.12)", color: "#276EF1" }}
        >
          {[
            "create",
            "pricing",
            "matching",
            "tracking",
            "code",
            "summary",
          ].indexOf(step) + 1}
          /6
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 px-4 py-2" style={{ background: cardBg }}>
        {(
          [
            "create",
            "pricing",
            "matching",
            "tracking",
            "code",
            "summary",
          ] as Step[]
        ).map((s, i) => (
          <div
            key={s}
            className="flex-1 h-1 rounded-full transition-all duration-500"
            style={{
              background:
                [
                  "create",
                  "pricing",
                  "matching",
                  "tracking",
                  "code",
                  "summary",
                ].indexOf(step) >= i
                  ? "#276EF1"
                  : isDark
                    ? "#374151"
                    : "#E5E7EB",
            }}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: CREATE */}
          {step === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <h2
                className="font-bold text-lg mb-4"
                style={{ color: textPrimary }}
              >
                Teslimat Oluştur
              </h2>

              <AddressInput
                label="📍 Alım Noktası (A)"
                placeholder="Teslimat başlangıç adresi..."
                value={pickupText}
                onChange={setPickupText}
                onSelect={(display, lat, lng) => {
                  setPickupText(display);
                  setPickupCoord([lat, lng]);
                }}
                isDark={isDark}
              />
              <AddressInput
                label="🏁 Teslim Noktası (B)"
                placeholder="Teslimat hedef adresi..."
                value={dropoffText}
                onChange={setDropoffText}
                onSelect={(display, lat, lng) => {
                  setDropoffText(display);
                  setDropoffCoord([lat, lng]);
                }}
                isDark={isDark}
              />

              <p
                className="block text-xs font-semibold mb-2"
                style={{ color: textSecondary }}
              >
                Paket Tipi
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {PACKAGE_TYPES.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setPackageType(pt.id)}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all"
                    style={{
                      background:
                        packageType === pt.id
                          ? "rgba(39,110,241,0.12)"
                          : isDark
                            ? "#1F2937"
                            : "#F6F6F6",
                      border: `2px solid ${packageType === pt.id ? "#276EF1" : "transparent"}`,
                    }}
                    data-ocid={`delivery.package_${pt.id}.button`}
                  >
                    <span className="text-2xl">{pt.emoji}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: packageType === pt.id ? "#276EF1" : textPrimary,
                      }}
                    >
                      {pt.label}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: textSecondary }}
                    >
                      {pt.desc}
                    </span>
                  </button>
                ))}
              </div>

              <div
                className="flex items-center justify-between px-4 py-3.5 rounded-xl mb-6"
                style={{
                  background: expressMode
                    ? "rgba(245,158,11,0.08)"
                    : isDark
                      ? "#1F2937"
                      : "#F6F6F6",
                }}
              >
                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: expressMode ? "#F59E0B" : textPrimary }}
                  >
                    ⚡ Express Mod
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: textSecondary }}
                  >
                    Daha hızlı eşleşme · x1.8 ücret · +10 token
                  </p>
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
                  if (pickupCoord && dropoffCoord) setStep("pricing");
                }}
                disabled={!pickupCoord || !dropoffCoord}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity"
                style={{
                  background:
                    pickupCoord && dropoffCoord ? "#276EF1" : "#9CA3AF",
                }}
                data-ocid="delivery.pricing.primary_button"
              >
                FİYAT HESAPLA
              </button>
            </motion.div>
          )}

          {/* STEP 2: PRICING */}
          {step === "pricing" && (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <h2
                className="font-bold text-lg mb-4"
                style={{ color: textPrimary }}
              >
                AI Fiyat Analizi
              </h2>

              <div
                className="rounded-2xl overflow-hidden mb-4"
                style={{
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${borderColor}` }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: textSecondary }}
                  >
                    Mesafe
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: textPrimary }}
                  >
                    {distance.toFixed(1)} km
                  </span>
                </div>
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${borderColor}` }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: textSecondary }}
                  >
                    Tahmini Süre
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: textPrimary }}
                  >
                    ~{eta} dk
                  </span>
                </div>
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${borderColor}` }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: textSecondary }}
                  >
                    Risk Seviyesi
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: riskColor }}
                  >
                    {riskLabel}
                  </span>
                </div>
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${borderColor}` }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: textSecondary }}
                  >
                    Teslimat Modu
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: expressMode ? "#F59E0B" : "#10B981" }}
                  >
                    {expressMode ? "⚡ Express" : "🐢 Normal"}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span
                    className="text-sm font-medium"
                    style={{ color: textSecondary }}
                  >
                    Kazanılacak Token
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: "#276EF1" }}
                  >
                    +{tokens} 🪙
                  </span>
                </div>
              </div>

              <div
                className="rounded-2xl p-5 mb-4 flex items-center justify-between"
                style={{
                  background: "rgba(39,110,241,0.08)",
                  border: "1.5px solid #276EF1",
                }}
              >
                <div>
                  <p
                    className="text-xs font-medium mb-0.5"
                    style={{ color: "#276EF1" }}
                  >
                    AI Önerilen Fiyat
                  </p>
                  <p
                    className="text-3xl font-black"
                    style={{ color: textPrimary }}
                  >
                    ₺{finalPrice.toFixed(0)}
                  </p>
                  {expressMode && (
                    <p className="text-xs" style={{ color: "#F59E0B" }}>
                      Temel: ₺{basePrice.toFixed(0)} × 1.8 (Express)
                    </p>
                  )}
                </div>
                <div className="text-4xl">💰</div>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5"
                style={{ background: isDark ? "#1F2937" : "#F0FDF4" }}
              >
                <Shield className="w-4 h-4" style={{ color: "#10B981" }} />
                <p
                  className="text-xs"
                  style={{ color: isDark ? "#34D399" : "#15803D" }}
                >
                  Nakit ödeme · Kişisel veri toplanmıyor · Oturum sonunda
                  silinir
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep("matching")}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 mb-2"
                style={{ background: "#276EF1" }}
                data-ocid="delivery.confirm.primary_button"
              >
                ONAYLA & KURYE BUL
              </button>
              <button
                type="button"
                onClick={() => setStep("create")}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: textSecondary }}
                data-ocid="delivery.back_to_create.button"
              >
                GERİ
              </button>
            </motion.div>
          )}

          {/* STEP 3: MATCHING */}
          {step === "matching" && (
            <MatchingStep
              courierId={courierId}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              cardBg={cardBg}
              borderColor={borderColor}
              onMatched={() => setStep("tracking")}
            />
          )}

          {/* STEP 4: TRACKING */}
          {step === "tracking" && (
            <motion.div
              key="tracking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
              style={{ height: "calc(100vh - 140px)" }}
            >
              {/* Map */}
              <div className="flex-1 relative" style={{ minHeight: 280 }}>
                <div
                  ref={mapRef}
                  className="w-full h-full"
                  style={{ minHeight: 280 }}
                />
                {/* ETA badge */}
                <div
                  className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg z-10"
                  style={{ background: "#141414" }}
                >
                  🚚 ~{Math.ceil(eta * (1 - trackProgress))} dk kaldı
                </div>
                {/* Progress bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ background: isDark ? "#374151" : "#E5E7EB" }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${trackProgress * 100}%`,
                      background: "#276EF1",
                    }}
                  />
                </div>
              </div>
              {/* Bottom panel */}
              <div
                className="p-4"
                style={{
                  background: cardBg,
                  borderTop: `1px solid ${borderColor}`,
                }}
              >
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
                {showCodeBtn && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    type="button"
                    onClick={() => setStep("code")}
                    className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide"
                    style={{ background: "#276EF1" }}
                    data-ocid="delivery.show_code.button"
                  >
                    TESLİMAT KODU GÖSTER
                  </motion.button>
                )}
                {!showCodeBtn && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: isDark ? "#374151" : "#F6F6F6" }}
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
                        style={{ background: "#276EF1" }}
                      />
                    </motion.div>
                    <p
                      className="text-xs font-medium"
                      style={{ color: textSecondary }}
                    >
                      Kurye yolda... Hedefe ulaşınca kod gösterilecek
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 5: CODE */}
          {step === "code" && (
            <motion.div
              key="code"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <h2
                className="font-bold text-lg mb-1"
                style={{ color: textPrimary }}
              >
                Teslimat Kodu
              </h2>
              <p className="text-xs mb-6" style={{ color: textSecondary }}>
                Bu tek kullanımlık kodu alıcıya verin
              </p>

              {/* Big code display */}
              <div
                className="rounded-2xl p-6 flex flex-col items-center mb-6"
                style={{
                  background: "rgba(39,110,241,0.08)",
                  border: "2px dashed #276EF1",
                }}
              >
                <p
                  className="text-xs font-medium mb-3"
                  style={{ color: "#276EF1" }}
                >
                  TEK KULLANIMLIK KOD
                </p>
                <div className="flex gap-2">
                  {deliveryCode.split("").map((digit, i) => (
                    <div
                      key={String.fromCharCode(65 + i)}
                      className="w-10 h-12 flex items-center justify-center rounded-xl text-2xl font-black"
                      style={{
                        background: cardBg,
                        color: textPrimary,
                        boxShadow: "0 2px 8px rgba(39,110,241,0.2)",
                      }}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3" style={{ color: textSecondary }}>
                  Alıcıya bu kodu verin
                </p>
              </div>

              <div className="mb-4">
                <p
                  className="block text-xs font-semibold mb-1.5"
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
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-center tracking-[0.3em] font-bold outline-none"
                  style={{
                    background: isDark ? "#1F2937" : "#F6F6F6",
                    color: codeError ? "#EF4444" : textPrimary,
                    border: `1.5px solid ${codeError ? "#EF4444" : borderColor}`,
                    fontSize: 20,
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
                  if (codeInput === deliveryCode) setStep("summary");
                  else setCodeError(true);
                }}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90 mb-4"
                style={{ background: "#276EF1" }}
                data-ocid="delivery.complete.submit_button"
              >
                TAMAMLA
              </button>

              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: isDark ? "#1F2937" : "#F0FDF4" }}
              >
                <Shield
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "#10B981" }}
                />
                <p
                  className="text-xs"
                  style={{ color: isDark ? "#34D399" : "#15803D" }}
                >
                  Kişisel veri saklanmıyor • Oturum silinecek
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 6: SUMMARY */}
          {step === "summary" && (
            <SummaryStep
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              cardBg={cardBg}
              borderColor={borderColor}
              duration={duration}
              distance={distance}
              packageType={packageType}
              expressMode={expressMode}
              tokens={tokens}
              rating={rating}
              setRating={setRating}
              courierId={courierId}
              onNewDelivery={() => {
                setStep("create");
                setPickupText("");
                setDropoffText("");
                setPickupCoord(null);
                setDropoffCoord(null);
                setCodeInput("");
                setCodeError(false);
                setRating(0);
                setTrackProgress(0);
                setShowCodeBtn(false);
              }}
              onBack={onBack}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Matching Step ───────────────────────────────────────────────────────────
function MatchingStep({
  courierId,
  isDark: _isDark,
  textPrimary,
  textSecondary,
  cardBg,
  borderColor,
  onMatched,
}: {
  courierId: string;
  isDark: boolean;
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
      className="p-4 flex flex-col items-center"
    >
      <div className="mt-8 mb-6 relative flex items-center justify-center">
        {!matched ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
              className="absolute w-24 h-24 rounded-full"
              style={{ background: "rgba(39,110,241,0.2)" }}
            />
            <motion.div
              animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0.05, 0.4] }}
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 2,
                delay: 0.3,
              }}
              className="absolute w-24 h-24 rounded-full"
              style={{ background: "rgba(39,110,241,0.15)" }}
            />
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center relative z-10"
              style={{ background: "rgba(39,110,241,0.12)" }}
            >
              <Truck className="w-7 h-7" style={{ color: "#276EF1" }} />
            </div>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.12)" }}
          >
            <CheckCircle className="w-8 h-8" style={{ color: "#10B981" }} />
          </motion.div>
        )}
      </div>

      {!matched ? (
        <>
          <p
            className="text-base font-bold mb-2"
            style={{ color: textPrimary }}
          >
            Kurye Aranıyor...
          </p>
          <p
            className="text-xs text-center mb-6"
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
            className="text-lg font-black text-center mb-1"
            style={{ color: "#10B981" }}
          >
            KURYE EŞLEŞTİ! ✅
          </p>
          <p
            className="text-xs text-center mb-5"
            style={{ color: textSecondary }}
          >
            Anonim kurye hazır
          </p>
          <div
            className="rounded-2xl p-4 mb-5"
            style={{ background: cardBg, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: "rgba(39,110,241,0.12)" }}
              >
                👻
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: textPrimary }}>
                  {courierId}
                </p>
                <p className="text-xs" style={{ color: textSecondary }}>
                  Anonim Kurye • Kimlik gizlendi
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}
            >
              <Shield className="w-3 h-3" />
              Güvenilir Kurye • 12 başarılı teslimat
            </div>
          </div>
          <button
            type="button"
            onClick={onMatched}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide transition-opacity hover:opacity-90"
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

// ── Summary Step ────────────────────────────────────────────────────────────
function SummaryStep({
  isDark,
  textPrimary,
  textSecondary,
  cardBg,
  borderColor,
  duration,
  distance,
  packageType,
  expressMode,
  tokens,
  rating,
  setRating,
  courierId,
  onNewDelivery,
  onBack,
}: {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderColor: string;
  duration: number;
  distance: number;
  packageType: PackageType;
  expressMode: boolean;
  tokens: number;
  rating: number;
  setRating: (n: number) => void;
  courierId: string;
  onNewDelivery: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4"
    >
      {/* Confetti-style decoration */}
      <div
        className="relative overflow-hidden rounded-2xl mb-4 p-5 text-center"
        style={{
          background: "rgba(39,110,241,0.08)",
          border: "1.5px solid #276EF1",
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {(
            [
              "a",
              "b",
              "c",
              "d",
              "e",
              "f",
              "g",
              "h",
              "j",
              "k",
              "m",
              "n",
            ] as const
          ).map((ck, i) => (
            <motion.div
              key={ck}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ["#276EF1", "#10B981", "#F59E0B", "#EF4444"][i % 4],
                left: `${(i * 8.3) % 100}%`,
                top: "-8px",
              }}
              animate={{
                y: [0, 120, 200],
                opacity: [1, 0.6, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2 + (i % 3) * 0.4,
                delay: i * 0.1,
                ease: "easeIn",
              }}
            />
          ))}
        </div>
        <div className="text-4xl mb-2">🎉</div>
        <p className="font-black text-xl" style={{ color: textPrimary }}>
          Teslimat Tamamlandı!
        </p>
        <p className="text-xs mt-1" style={{ color: textSecondary }}>
          Başarıyla teslim edildi
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Süre", value: `${Math.max(duration, 1)} dk`, emoji: "⏱️" },
          { label: "Mesafe", value: `${distance.toFixed(1)} km`, emoji: "📍" },
          { label: "Token Kazanıldı", value: `+${tokens} 🪙`, emoji: "💰" },
          { label: "Karma", value: "+2 ⬆️", emoji: "✨" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3.5"
            style={{ background: cardBg, border: `1px solid ${borderColor}` }}
          >
            <p className="text-lg mb-0.5">{stat.emoji}</p>
            <p className="text-base font-black" style={{ color: textPrimary }}>
              {stat.value}
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Package + mode badge */}
      <div className="flex gap-2 mb-4">
        <div
          className="flex-1 rounded-xl p-3 flex items-center gap-2"
          style={{ background: cardBg, border: `1px solid ${borderColor}` }}
        >
          <span className="text-xl">
            {packageType === "small"
              ? "📦"
              : packageType === "medium"
                ? "📫"
                : "🔒"}
          </span>
          <div>
            <p className="text-xs" style={{ color: textSecondary }}>
              Paket
            </p>
            <p className="text-sm font-bold" style={{ color: textPrimary }}>
              {packageType === "small"
                ? "Küçük"
                : packageType === "medium"
                  ? "Orta"
                  : "Hassas"}
            </p>
          </div>
        </div>
        <div
          className="flex-1 rounded-xl p-3 flex items-center gap-2"
          style={{ background: cardBg, border: `1px solid ${borderColor}` }}
        >
          <span className="text-xl">{expressMode ? "⚡" : "🐢"}</span>
          <div>
            <p className="text-xs" style={{ color: textSecondary }}>
              Mod
            </p>
            <p
              className="text-sm font-bold"
              style={{ color: expressMode ? "#F59E0B" : "#10B981" }}
            >
              {expressMode ? "Express" : "Normal"}
            </p>
          </div>
        </div>
      </div>

      {/* Anonymous rating */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: cardBg, border: `1px solid ${borderColor}` }}
      >
        <p
          className="text-sm font-semibold mb-1"
          style={{ color: textPrimary }}
        >
          Kurye Değerlendirmesi
        </p>
        <p className="text-xs mb-3" style={{ color: textSecondary }}>
          {courierId} · Anonim değerlendirme
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className="text-2xl transition-transform hover:scale-110"
              data-ocid="delivery.rating.button"
            >
              <Star
                className="w-7 h-7"
                fill={rating >= n ? "#F59E0B" : "none"}
                style={{
                  color:
                    rating >= n ? "#F59E0B" : isDark ? "#374151" : "#D1D5DB",
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5"
        style={{ background: isDark ? "#1F2937" : "#F0FDF4" }}
      >
        <Shield
          className="w-4 h-4 flex-shrink-0"
          style={{ color: "#10B981" }}
        />
        <p
          className="text-xs"
          style={{ color: isDark ? "#34D399" : "#15803D" }}
        >
          Kişisel veri saklanmıyor • Oturum verileri silindi
        </p>
      </div>

      <button
        type="button"
        onClick={onNewDelivery}
        className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide mb-2 transition-opacity hover:opacity-90"
        style={{ background: "#276EF1" }}
        data-ocid="delivery.new_delivery.primary_button"
      >
        YENİ TESLİMAT
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: textSecondary }}
        data-ocid="delivery.home.button"
      >
        ANA SAYFA
      </button>
    </motion.div>
  );
}
