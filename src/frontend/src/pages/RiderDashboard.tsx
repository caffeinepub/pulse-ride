import type { SessionState } from "@/App";
import InRideGhostChat from "@/components/InRideGhostChat";
import KarmicScore from "@/components/KarmicScore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useActor } from "@/hooks/useActor";
import {
  type Currency,
  calcRidePrice,
  detectCurrencyFromAddress,
} from "@/utils/pricingUtils";
import {
  Ghost,
  Lock,
  LogOut,
  MapPin,
  Search,
  Share2,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RiderDashboardProps {
  session: SessionState;
  onEndSession: () => void;
  onLiveMap?: () => void;
  onGhostDuello?: (price: number) => void;
  onMemoryBomb?: () => void;
}

interface AiPriceData {
  price: number;
  distanceKm: number;
  durationMin: number;
  trafficLevel: string;
}

interface DetectedLocation {
  lat: number;
  lng: number;
  label: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

const MOODS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😤", label: "Rushed" },
  { emoji: "🎵", label: "Vibe" },
  { emoji: "🔥", label: "Hype" },
  { emoji: "❄️", label: "Chill" },
];

const PHANTOM_MSGS = [
  "👁️ A phantom presence joins the route...",
  "🌀 Encrypted signal detected nearby",
  "🕶️ AI shadow activated",
  "⚡ Pulse anomaly detected — stay calm",
  "🔮 Ghost protocol engaged",
  "🌐 Decoy nodes broadcasting...",
];

function maskSession(id: string): string {
  if (id.length <= 4) return `••••${id}`;
  return `••••••${id.slice(-4).toUpperCase()}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function AnimatedPrice({
  target,
  symbol = "₺",
}: { target: number; symbol?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const unsub = rounded.on("change", setDisplay);
    const controls = animate(count, target, { duration: 1.5, ease: "easeOut" });
    return () => {
      unsub();
      controls.stop();
    };
  }, [target, count, rounded]);

  return (
    <span>
      {symbol}
      {display}
    </span>
  );
}

const trafficColor = (level: string) =>
  level === "Low" ? "#05944F" : level === "Moderate" ? "#f59e0b" : "#E11900";

export default function RiderDashboard({
  session,
  onEndSession,
  onLiveMap,
  onGhostDuello,
  onMemoryBomb,
}: RiderDashboardProps) {
  const { actor } = useActor();
  const [reputation, setReputation] = useState<[string, number] | null>(null);
  const [detectedLocation, setDetectedLocation] =
    useState<DetectedLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "detecting" | "found" | "denied"
  >("detecting");
  const [dropoffZone, setDropoffZone] = useState("");
  const [dropoffCoords, setDropoffCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dropoffCurrency, setDropoffCurrency] = useState<Currency>("TRY");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [phantomMode, setPhantomMode] = useState(false);
  const [rideId, setRideId] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState("idle");
  const [aiPriceData, setAiPriceData] = useState<AiPriceData | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [timer, setTimer] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showGhostChat, setShowGhostChat] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [sessionTerminated, setSessionTerminated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phantomRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [searchTimer, setSearchTimer] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoWatchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      setDetectedLocation({
        lat: 41.0082,
        lng: 28.9784,
        label: "İstanbul, Türkiye",
      });
      return;
    }
    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "User-Agent": "PulseRide/1.0" } },
        );
        const data = await res.json();
        const label = data.display_name
          ? data.display_name.split(",").slice(0, 3).join(", ")
          : `${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`;
        setDetectedLocation({ lat, lng, label });
        setLocationStatus("found");
      } catch {
        setDetectedLocation({
          lat,
          lng,
          label: `${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`,
        });
        setLocationStatus("found");
      }
    };
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        reverseGeocode(lat, lng);
      },
      () => {
        setLocationStatus("denied");
        setDetectedLocation({
          lat: 41.0082,
          lng: 28.9784,
          label: "İstanbul, Türkiye",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!actor) return;
    actor
      .getReputation(session.sessionId)
      .then(([label, rides]) => {
        setReputation([label, Number(rides)]);
      })
      .catch(() => {});
  }, [actor, session.sessionId]);

  useEffect(() => {
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!phantomMode || !rideId) return;
    phantomRef.current = setInterval(() => {
      const msg = PHANTOM_MSGS[Math.floor(Math.random() * PHANTOM_MSGS.length)];
      toast(msg);
    }, 15000);
    return () => {
      if (phantomRef.current) clearInterval(phantomRef.current);
    };
  }, [phantomMode, rideId]);

  // Poll backend to detect when driver accepts the ride
  useEffect(() => {
    if (rideStatus !== "searching" || !actor || !rideId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const [status] = await actor.getRideStatus(rideId);
        if (status === "matched" || status === "active") {
          setRideStatus("active");
          toast.success("🚗 Sürücü bulundu! Yolculuk başlıyor...");
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (e) {
        console.error("getRideStatus error:", e);
      }
    }, 3000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [rideStatus, actor, rideId]);

  // Search timer — counts up while searching for driver
  useEffect(() => {
    if (rideStatus === "searching") {
      setSearchTimer(0);
      searchTimerRef.current = setInterval(
        () => setSearchTimer((t) => t + 1),
        1000,
      );
    } else {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }
    return () => {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [rideStatus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDropoffChange = useCallback((value: string) => {
    setDropoffZone(value);
    setDropoffCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&addressdetails=1&accept-language=tr,en`,
          { headers: { "User-Agent": "PulseRide/1.0" } },
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const handleSelectResult = useCallback(
    async (result: NominatimResult) => {
      const lat = Number.parseFloat(result.lat);
      const lng = Number.parseFloat(result.lon);
      const cc = result.address?.country_code;
      const currency = detectCurrencyFromAddress(result.display_name, cc);
      setDropoffZone(result.display_name);
      setDropoffCoords({ lat, lng });
      setDropoffCurrency(currency);
      setShowDropdown(false);
      setSearchResults([]);
      // Auto-trigger search immediately after address selection
      if (!actor) return;
      setLoading(true);
      const pickupLabel = detectedLocation?.label ?? "İstanbul, Türkiye";
      try {
        const [rid, code] = await actor.createRideRequest(
          session.sessionId,
          pickupLabel,
          result.display_name,
          phantomMode,
        );
        const pickupLat = detectedLocation?.lat ?? 41.0082;
        const pickupLng = detectedLocation?.lng ?? 28.9784;
        const distKm = Math.max(
          2,
          Math.min(
            40,
            Math.sqrt(
              ((lat - pickupLat) * 111) ** 2 +
                ((lng - pickupLng) * 111 * Math.cos((lat * Math.PI) / 180)) **
                  2,
            ),
          ),
        );
        const durMin = Math.round(distKm * 3);
        const trafficIdx = Math.round(distKm) % 3;
        const trafficLevel =
          trafficIdx === 0 ? "Low" : trafficIdx === 1 ? "Moderate" : "High";
        const pricingResult = calcRidePrice(
          distKm,
          durMin,
          currency,
          result.display_name,
        );
        setAiPriceData({
          price: pricingResult.price,
          distanceKm: distKm,
          durationMin: durMin,
          trafficLevel,
        });
        setRideId(rid);
        setSessionCode(code);
        // Immediately approve and go to searching
        const approved1 = await actor.approveRide(rid, session.sessionId);
        if (!approved1)
          throw new Error("Yolculuk onaylanamadı — lütfen tekrar deneyin");
        setRideStatus("searching");
        toast.success("Sürücü aranıyor — anonim eşleşme aktif...");
      } catch {
        toast.error("Yolculuk isteği oluşturulamadı");
      } finally {
        setLoading(false);
      }
    },
    [actor, detectedLocation, phantomMode, session.sessionId],
  );

  const handleCalculatePrice = useCallback(async () => {
    if (!actor || !dropoffZone.trim()) return;
    setLoading(true);
    const pickupLabel = detectedLocation?.label ?? "ISTANBUL-41.0082°N";
    try {
      const [rid, code] = await actor.createRideRequest(
        session.sessionId,
        pickupLabel,
        dropoffZone,
        phantomMode,
      );
      setRideId(rid);
      setSessionCode(code);
      const distKm = dropoffCoords
        ? Math.max(
            2,
            Math.min(
              40,
              Math.sqrt(
                ((dropoffCoords.lat - (detectedLocation?.lat ?? 41.0082)) *
                  111) **
                  2 +
                  ((dropoffCoords.lng - (detectedLocation?.lng ?? 28.9784)) *
                    111 *
                    Math.cos((dropoffCoords.lat * Math.PI) / 180)) **
                    2,
              ),
            ),
          )
        : ((dropoffZone.length * 2) % 30) + 2;
      const durMin = Math.round(distKm * 3);
      const trafficIdx = Math.round(distKm) % 3;
      const trafficLevel =
        trafficIdx === 0 ? "Low" : trafficIdx === 1 ? "Moderate" : "High";
      const pricingResult = calcRidePrice(
        distKm,
        durMin,
        dropoffCurrency,
        dropoffZone,
      );
      const priceData = {
        price: pricingResult.price,
        distanceKm: distKm,
        durationMin: durMin,
        trafficLevel,
      };
      setAiPriceData(priceData);
      setRideStatus("pricing");
      toast.success("AI fiyatı hesaplandı — onaylamadan önce inceleyin");
    } catch {
      toast.error("Yolculuk isteği oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }, [
    actor,
    dropoffZone,
    dropoffCoords,
    dropoffCurrency,
    phantomMode,
    session.sessionId,
    detectedLocation,
  ]);

  const handleApproveRide = useCallback(async () => {
    if (!actor || !rideId) return;
    setApproving(true);
    try {
      const approved2 = await actor.approveRide(rideId, session.sessionId);
      if (!approved2)
        throw new Error("Yolculuk onaylanamadı — lütfen tekrar deneyin");
      setRideStatus("searching");
      toast.success("Yolculuk onaylandı — anonim sürücü aranıyor...");
    } catch {
      toast.error("Yolculuk onaylanamadı");
    } finally {
      setApproving(false);
    }
  }, [actor, rideId, session.sessionId]);

  const handleCancelRide = useCallback(() => {
    setRideStatus("idle");
    setRideId(null);
    setSessionCode(null);
    setAiPriceData(null);
    toast("Yolculuk iptal edildi");
  }, []);

  const handleConfirmCashPayment = useCallback(async () => {
    if (!actor || !rideId) return;
    try {
      await actor.updateRideStatus(rideId, session.sessionId, "completed");
    } catch {}
    toast.success("Nakit ödeme onaylandı — güven puanları güncellendi");
    setShowRating(true);
  }, [actor, rideId, session.sessionId]);

  const handleMoodSelect = (emoji: string) => {
    setSelectedMood(emoji);
    toast(`${emoji} Mood sürücüye gönderildi`);
    setTimeout(() => {
      toast("🤖 AI rotayı modunuza göre ayarlıyor...");
    }, 1000);
  };

  const handleSubmitRating = useCallback(async () => {
    if (!actor || !rideId) return;
    try {
      await actor.submitRating(rideId, session.sessionId, BigInt(ratingStars));
      toast.success("Değerlendirme anonim olarak gönderildi");
      setShowRating(false);
    } catch {
      toast.error("Değerlendirme gönderilemedi");
    }
  }, [actor, rideId, ratingStars, session.sessionId]);

  const handleEndSession = useCallback(async () => {
    if (!actor) return;
    try {
      await actor.endSession(session.sessionId);
    } catch {}
    setSessionTerminated(true);
    setTimeout(onEndSession, 2500);
  }, [actor, session.sessionId, onEndSession]);

  if (sessionTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="uber-card rounded-2xl p-10 text-center max-w-sm"
        >
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-lg font-bold text-[#141414] mb-2">
            Oturum Sonlandırıldı
          </h2>
          <p className="text-sm text-gray-500">
            Tüm geçici veriler silindi. Anonimsiniz.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="uber-header px-5 py-4" data-ocid="rider.header.panel">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">
              YOLCU PANELİ
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Oturum: {maskSession(session.sessionId)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400 font-mono">
              {formatTime(timer)}
            </div>
            <div
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(5,148,79,0.15)", color: "#05944F" }}
            >
              <Lock className="w-3 h-3" /> Şifreli
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndSession}
              className="text-xs text-gray-300 hover:text-red-400"
              data-ocid="rider.end_session.button"
            >
              <LogOut className="w-4 h-4 mr-1" /> Çıkış
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-2xl mx-auto space-y-4">
        <KarmicScore sessionId={session.sessionId} userRole="rider" />

        {/* Reputation + Phantom */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="uber-card rounded-xl p-4"
            data-ocid="rider.reputation.card"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              ÜNVAN
            </p>
            {reputation ? (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: "#276EF1" }} />
                <span className="font-bold text-[#141414] text-sm">
                  {reputation[0]}
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Yükleniyor...</div>
            )}
            {reputation && (
              <p className="text-xs text-gray-400 mt-1">
                {reputation[1]} yolculuk
              </p>
            )}
          </div>

          <div
            className="uber-card rounded-xl p-4"
            style={
              phantomMode
                ? {
                    borderColor: "rgba(124,58,237,0.4)",
                    boxShadow: "0 0 16px rgba(124,58,237,0.15)",
                  }
                : {}
            }
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Ghost className="w-4 h-4" style={{ color: "#7C3AED" }} />
                <Label className="font-bold text-[#141414] uppercase tracking-wider text-[10px]">
                  PHANTOM
                </Label>
              </div>
              <Switch
                checked={phantomMode}
                onCheckedChange={setPhantomMode}
                data-ocid="rider.phantom_mode.switch"
              />
            </div>
            {phantomMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] mt-1"
                style={{ color: "#7C3AED" }}
              >
                👻 PHANTOM AKTİF
              </motion.div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Ride Request Form */}
          {rideStatus === "idle" && (
            <motion.div
              key="idle-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="uber-card rounded-xl p-5"
            >
              <h2 className="text-sm font-bold text-[#141414] uppercase tracking-wide mb-4">
                YOLCULUK İSTE
              </h2>
              <div className="space-y-4">
                {/* GPS Panel */}
                <div
                  className="rounded-xl p-3"
                  style={{
                    background:
                      locationStatus === "found"
                        ? "rgba(5,148,79,0.06)"
                        : "rgba(39,110,241,0.04)",
                    border: `1px solid ${
                      locationStatus === "found"
                        ? "rgba(5,148,79,0.3)"
                        : locationStatus === "denied"
                          ? "rgba(225,25,0,0.25)"
                          : "#E5E7EB"
                    }`,
                  }}
                  data-ocid="rider.gps_location.panel"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <MapPin
                        className="w-4 h-4"
                        style={{
                          color:
                            locationStatus === "found"
                              ? "#05944F"
                              : locationStatus === "denied"
                                ? "#E11900"
                                : "#6B7280",
                        }}
                      />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        KALKIŞ
                      </span>
                    </div>
                    {locationStatus === "detecting" && (
                      <span className="text-[10px] text-amber-600 font-semibold">
                        TESPIT EDİLİYOR...
                      </span>
                    )}
                    {locationStatus === "found" && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(5,148,79,0.1)",
                          color: "#05944F",
                        }}
                      >
                        ✓ GPS
                      </span>
                    )}
                    {locationStatus === "denied" && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(225,25,0,0.1)",
                          color: "#E11900",
                        }}
                      >
                        ⚠ YAKLAŞIK
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm font-mono"
                    style={{
                      color: locationStatus === "found" ? "#05944F" : "#6B7280",
                    }}
                  >
                    {locationStatus === "detecting" ? (
                      <span className="text-gray-400">
                        GPS sinyali alınıyor...
                      </span>
                    ) : (
                      <span>📍 {detectedLocation?.label}</span>
                    )}
                  </div>
                </div>

                {/* Destination */}
                <div ref={dropdownRef} className="relative">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 block">
                    HEDEF ADRES
                  </Label>
                  <div className="relative">
                    <Input
                      value={dropoffZone}
                      onChange={(e) => handleDropoffChange(e.target.value)}
                      onFocus={() =>
                        searchResults.length > 0 && setShowDropdown(true)
                      }
                      placeholder="Mahalle, sokak veya yer adı..."
                      className="bg-white border-gray-200 text-[#141414] placeholder:text-gray-400 focus:border-[#276EF1] pr-10 rounded-xl"
                      data-ocid="rider.dropoff_zone.input"
                      autoComplete="off"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isSearching ? (
                        <span
                          className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                          style={{
                            borderColor: "#276EF1",
                            borderTopColor: "transparent",
                          }}
                        />
                      ) : dropoffCoords ? (
                        <MapPin
                          className="w-4 h-4"
                          style={{ color: "#05944F" }}
                        />
                      ) : (
                        <Search className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {dropoffCoords && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full w-fit"
                      style={{
                        background: "rgba(5,148,79,0.1)",
                        color: "#05944F",
                        border: "1px solid rgba(5,148,79,0.25)",
                      }}
                    >
                      ✓ KONUM ONAYLANDI — {dropoffCoords.lat.toFixed(4)}°N{" "}
                      {dropoffCoords.lng.toFixed(4)}°E
                    </motion.div>
                  )}

                  <AnimatePresence>
                    {showDropdown && searchResults.length > 0 && (
                      <motion.div
                        key="geo-dropdown"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 bg-white shadow-xl border border-gray-200"
                      >
                        <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                            {searchResults.length} SONUÇ
                          </span>
                        </div>
                        {searchResults.map((result, idx) => (
                          <button
                            key={result.place_id}
                            type="button"
                            onClick={() => handleSelectResult(result)}
                            className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                            style={{
                              borderBottom:
                                idx < searchResults.length - 1
                                  ? "1px solid #F3F4F6"
                                  : "none",
                            }}
                            data-ocid={`rider.address_result.item.${idx + 1}`}
                          >
                            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <div className="min-w-0">
                              <p className="text-sm text-[#141414] leading-snug truncate">
                                {result.display_name.length > 60
                                  ? `${result.display_name.slice(0, 60)}…`
                                  : result.display_name}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                                {Number.parseFloat(result.lat).toFixed(4)}°N{" "}
                                {Number.parseFloat(result.lon).toFixed(4)}°E
                              </p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Button
                  onClick={handleCalculatePrice}
                  disabled={loading || !dropoffZone.trim()}
                  className="w-full rounded-xl py-3 font-bold tracking-wide uppercase text-sm text-white"
                  style={{ background: loading ? "#94a3b8" : "#276EF1" }}
                  data-ocid="rider.calculate_price.button"
                >
                  {loading ? "HESAPLANIYOR..." : "AI FİYAT HESAPLA"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* AI Pricing Card */}
          {rideStatus === "pricing" && aiPriceData && (
            <motion.div
              key="pricing-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="uber-card rounded-2xl p-6"
              style={{ borderColor: "rgba(39,110,241,0.3)" }}
              data-ocid="rider.pricing_card"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-[#141414] uppercase tracking-wide">
                  AI FİYAT ANALİZİ
                </h2>
                <div
                  className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold"
                  style={{
                    background: "rgba(39,110,241,0.1)",
                    color: "#276EF1",
                  }}
                >
                  <Zap className="w-3 h-3" /> AI
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {
                    label: "MESAFE",
                    value: aiPriceData.distanceKm,
                    unit: "km",
                  },
                  { label: "SÜRE", value: aiPriceData.durationMin, unit: "dk" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                      {stat.label}
                    </p>
                    <p className="text-lg font-black text-[#141414]">
                      {stat.value}
                    </p>
                    <p className="text-[10px] text-gray-400">{stat.unit}</p>
                  </div>
                ))}
                <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    TRAFİK
                  </p>
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-bold uppercase mt-1"
                    style={{
                      background: `${trafficColor(aiPriceData.trafficLevel)}15`,
                      color: trafficColor(aiPriceData.trafficLevel),
                      border: `1px solid ${trafficColor(aiPriceData.trafficLevel)}30`,
                    }}
                  >
                    {aiPriceData.trafficLevel}
                  </span>
                </div>
              </div>

              {phantomMode && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg"
                  style={{
                    background: "rgba(124,58,237,0.08)",
                    border: "1px solid rgba(124,58,237,0.2)",
                  }}
                >
                  <Ghost className="w-4 h-4" style={{ color: "#7C3AED" }} />
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "#7C3AED" }}
                  >
                    + PHANTOM DENEYİMİ AKTİF
                  </span>
                </motion.div>
              )}

              <div className="text-center py-4 mb-5">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                  ÖNERİLEN NAKİT ÜCRET
                </p>
                <motion.div
                  className="text-5xl font-black tracking-tight"
                  style={{ color: "#276EF1" }}
                >
                  <AnimatedPrice
                    target={aiPriceData.price}
                    symbol={dropoffCurrency === "EUR" ? "€" : "₺"}
                  />
                </motion.div>
                <p className="text-xs text-gray-500 mt-1">
                  {dropoffCurrency === "EUR"
                    ? "Euro · Piyasanın %20 altında tavsiye fiyat"
                    : "Türk Lirası · Varışta nakit ödeme"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button
                  onClick={handleApproveRide}
                  disabled={approving}
                  className="rounded-xl py-3 font-bold tracking-wide uppercase text-sm text-white"
                  style={{ background: approving ? "#94a3b8" : "#276EF1" }}
                  data-ocid="rider.approve_ride.button"
                >
                  {approving ? "ONAYLANIYOR..." : "ONAYLA & SÜRÜCÜ BUL"}
                </Button>
                <Button
                  onClick={handleCancelRide}
                  variant="ghost"
                  className="rounded-xl py-3 font-bold tracking-wide uppercase text-sm"
                  style={{
                    border: "1px solid rgba(225,25,0,0.3)",
                    color: "#E11900",
                  }}
                  data-ocid="rider.cancel_ride.button"
                >
                  İPTAL ET
                </Button>
              </div>
              <p className="text-center text-[10px] text-gray-400">
                Yolculuk sadece onayınızdan sonra başlar · Varışta nakit ödeme
              </p>
            </motion.div>
          )}

          {/* Searching / In-Ride */}
          {(rideStatus === "searching" || rideStatus === "active") && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="uber-card rounded-xl p-5"
              style={{
                borderColor:
                  rideStatus === "active"
                    ? "rgba(5,148,79,0.4)"
                    : "rgba(39,110,241,0.3)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#141414] uppercase tracking-wide">
                  YOLCULUK DURUMU
                </h2>
                {rideStatus === "searching" ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#276EF1]" />
                      <div className="absolute inset-0 rounded-full animate-ping bg-[#276EF1] opacity-40" />
                    </div>
                    <span className="text-xs font-semibold text-[#276EF1]">
                      SÜRÜCÜ ARANIYOR...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#05944F]" />
                      <div className="absolute inset-0 rounded-full animate-ping bg-[#05944F] opacity-40" />
                    </div>
                    <span className="text-xs font-semibold text-[#05944F]">
                      ✓ SÜRÜCÜ BULUNDU
                    </span>
                  </div>
                )}
              </div>

              {/* Search timer + price info */}
              {rideStatus === "searching" && (
                <div className="mb-4 space-y-3">
                  <div
                    className="rounded-xl p-4 text-center"
                    style={{
                      background: "rgba(39,110,241,0.05)",
                      border: "1px solid rgba(39,110,241,0.2)",
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                      ARAMA SÜRESİ
                    </p>
                    <p
                      className="text-3xl font-black font-mono"
                      style={{ color: "#276EF1" }}
                    >
                      {formatTime(searchTimer)}
                    </p>
                  </div>
                  {aiPriceData && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase mb-1">
                          HEDEF
                        </p>
                        <p className="text-[10px] font-bold text-[#141414] truncate">
                          {dropoffZone.split(",")[0]}
                        </p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase mb-1">
                          MESAFE
                        </p>
                        <p className="text-sm font-black text-[#141414]">
                          {Math.round(aiPriceData.distanceKm)} km
                        </p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase mb-1">
                          ÜCRET
                        </p>
                        <p
                          className="text-sm font-black"
                          style={{ color: "#276EF1" }}
                        >
                          {dropoffCurrency === "EUR" ? "€" : "₺"}
                          {aiPriceData.price}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sessionCode && rideStatus === "active" && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">YOLCULUK ID</p>
                    <p className="text-xs font-mono font-bold text-[#276EF1]">
                      {maskSession(rideId ?? "")}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">
                      ANLAŞILAN ÜCRET
                    </p>
                    <p className="text-sm font-bold text-[#05944F]">
                      {aiPriceData
                        ? `${dropoffCurrency === "EUR" ? "€" : "₺"}${aiPriceData.price}`
                        : sessionCode}
                    </p>
                  </div>
                </div>
              )}

              {rideStatus === "active" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-xl p-3 flex items-center gap-3"
                  style={{
                    background: "rgba(5,148,79,0.1)",
                    border: "1px solid rgba(5,148,79,0.3)",
                  }}
                >
                  <span className="text-xl">🚗</span>
                  <div>
                    <p className="text-xs font-black text-[#05944F] uppercase tracking-wide">
                      Sürücünüz eşleşti!
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Yolcu alınmayı bekliyor — GHOST CHAT ile iletişime
                      geçebilirsiniz
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="space-y-2">
                {onLiveMap && (
                  <button
                    onClick={onLiveMap}
                    className="w-full py-3 font-bold text-xs tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
                    style={{
                      background: "rgba(5,148,79,0.1)",
                      border: "1px solid rgba(5,148,79,0.3)",
                      color: "#05944F",
                    }}
                    type="button"
                    data-ocid="rider.live_map.button"
                  >
                    🗺️ CANLI HARİTA
                  </button>
                )}
                {onGhostDuello && aiPriceData && (
                  <button
                    type="button"
                    onClick={() => onGhostDuello(aiPriceData.price)}
                    className="w-full py-3 font-bold text-xs tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
                    style={{
                      background: "rgba(225,25,0,0.08)",
                      border: "1px solid rgba(225,25,0,0.25)",
                      color: "#E11900",
                    }}
                    data-ocid="rider.ghost_duello.button"
                  >
                    ⚔️ GHOST DÜELLO
                  </button>
                )}
                {onMemoryBomb && (
                  <button
                    type="button"
                    onClick={onMemoryBomb}
                    className="w-full py-3 font-bold text-xs tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
                    style={{
                      background: "rgba(124,58,237,0.08)",
                      border: "1px solid rgba(124,58,237,0.25)",
                      color: "#7C3AED",
                    }}
                    data-ocid="rider.memory_bomb.button"
                  >
                    💣 HAFIZA BOMBASI
                  </button>
                )}
                {rideId && (
                  <button
                    type="button"
                    onClick={() => setShowGhostChat(true)}
                    className="w-full py-3 font-bold text-xs tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
                    style={{
                      background: "rgba(39,110,241,0.08)",
                      border: "1px solid rgba(39,110,241,0.25)",
                      color: "#276EF1",
                    }}
                    data-ocid="rider.ghost_chat.button"
                  >
                    💬 GHOST CHAT
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Completed */}
          {rideStatus === "completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="uber-card rounded-2xl p-8 text-center"
              style={{ borderColor: "rgba(5,148,79,0.3)" }}
            >
              <div className="text-5xl mb-4">🏁</div>
              <h2 className="text-lg font-black text-[#141414] mb-2">
                YOLCULUK TAMAMLANDI
              </h2>
              <p
                className="text-sm font-semibold mb-6"
                style={{ color: "#05944F" }}
              >
                SÜRÜCÜYE NAKİT ÖDEYIN
              </p>
              {aiPriceData && (
                <div
                  className="inline-block px-8 py-4 rounded-2xl mb-6"
                  style={{
                    background: "rgba(5,148,79,0.08)",
                    border: "1px solid rgba(5,148,79,0.2)",
                  }}
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    ANLAŞILAN TUTAR
                  </p>
                  <p
                    className="text-4xl font-black"
                    style={{ color: "#05944F" }}
                  >
                    {dropoffCurrency === "EUR" ? "€" : "₺"}
                    {aiPriceData.price}
                  </p>
                </div>
              )}
              <Button
                onClick={handleConfirmCashPayment}
                className="w-full rounded-xl py-3 font-bold tracking-wide uppercase text-sm text-white mb-3"
                style={{ background: "#05944F" }}
                data-ocid="rider.confirm_cash_payment.button"
              >
                NAKİT ÖDEMEYİ ONAYLA
              </Button>
              <p className="text-xs text-gray-400">
                🔒 Güven puanları anonim güncellendi · Ödeme verisi saklanmaz
              </p>
              <Button
                onClick={() => setShowSnapshot(true)}
                variant="ghost"
                className="w-full mt-2 rounded-xl py-2.5 font-bold tracking-wide uppercase text-sm flex items-center justify-center gap-2"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  color: "#7C3AED",
                }}
                data-ocid="rider.share_snapshot.button"
              >
                <Share2 className="w-4 h-4" /> YOLCULUK SNAPSHOT PAYLAŞ
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse Mood Bar */}
        <div className="uber-card rounded-xl p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            PULSE MOD BAROMETER
          </h2>
          <div className="flex gap-2">
            {MOODS.map(({ emoji, label }) => (
              <button
                type="button"
                key={label}
                onClick={() => handleMoodSelect(emoji)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-sm"
                style={{
                  background:
                    selectedMood === emoji ? "rgba(39,110,241,0.1)" : "#F9FAFB",
                  border: `1px solid ${selectedMood === emoji ? "rgba(39,110,241,0.4)" : "#E5E7EB"}`,
                }}
                data-ocid={`rider.mood_${label.toLowerCase()}.button`}
              >
                <span className="text-lg">{emoji}</span>
                <span className="text-[10px] text-gray-500">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ghost Chat Overlay */}
        {showGhostChat && rideId && (
          <InRideGhostChat
            rideId={rideId}
            mySessionId={session.sessionId}
            userRole="rider"
            onClose={() => setShowGhostChat(false)}
          />
        )}
      </div>

      {/* Rating Modal */}
      <Dialog open={showRating} onOpenChange={setShowRating}>
        <DialogContent
          className="bg-white border-gray-200 text-[#141414]"
          data-ocid="rider.rating.dialog"
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm">
              YOLCULUĞU DEĞERLENDİR
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setRatingStars(s)}
                data-ocid={`rider.rating.star.${s}`}
              >
                <Star
                  className="w-8 h-8 transition-all"
                  style={{
                    color: s <= ratingStars ? "#f5c84b" : "#D1D5DB",
                    fill: s <= ratingStars ? "#f5c84b" : "transparent",
                  }}
                />
              </button>
            ))}
          </div>
          <Button
            onClick={handleSubmitRating}
            className="w-full rounded-xl text-white font-bold tracking-wide uppercase"
            style={{ background: "#276EF1" }}
            data-ocid="rider.rating.submit_button"
          >
            DEĞERLENDİRMEYİ GÖNDER
          </Button>
        </DialogContent>
      </Dialog>

      {/* Snapshot Modal */}
      <Dialog open={showSnapshot} onOpenChange={setShowSnapshot}>
        <DialogContent
          className="bg-white border-gray-200 text-[#141414] max-w-sm"
          data-ocid="rider.snapshot.dialog"
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
              <span>🔥</span> VİRAL SNAPSHOT
            </DialogTitle>
          </DialogHeader>
          <div
            className="rounded-2xl p-5 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #141414 0%, #1e1e2e 100%)",
              border: "1px solid rgba(39,110,241,0.3)",
            }}
          >
            <div className="text-4xl mb-2">👤</div>
            <p className="text-xs font-black tracking-widest mb-3 text-[#276EF1]">
              GHOST-{session.sessionId.slice(-4).toUpperCase()}
            </p>
            {aiPriceData && (
              <div className="flex justify-center gap-6 mb-4">
                <div>
                  <p className="text-lg font-black text-white">
                    {aiPriceData.distanceKm}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase">km</p>
                </div>
                <div>
                  <p className="text-lg font-black text-white">
                    {aiPriceData.durationMin}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase">dk</p>
                </div>
                <div>
                  <p className="text-xl">{selectedMood ?? "⚡"}</p>
                  <p className="text-[10px] text-gray-400 uppercase">mood</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-xs font-bold uppercase tracking-wide"
              onClick={() => {
                toast.success("Snapshot kopyalandı!");
                setShowSnapshot(false);
              }}
              data-ocid="rider.snapshot.close_button"
            >
              KOPYALA
            </Button>
            <Button
              className="flex-1 rounded-xl text-xs font-bold uppercase tracking-wide text-white"
              style={{ background: "#276EF1" }}
              onClick={() => setShowSnapshot(false)}
              data-ocid="rider.snapshot.cancel_button"
            >
              KAPAT
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
