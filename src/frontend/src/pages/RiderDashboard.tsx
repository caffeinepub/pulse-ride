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
  Ghost,
  Lock,
  LogOut,
  MapPin,
  Send,
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

function calcAiPrice(
  dropoff: string,
  coords?: { lat: number; lng: number } | null,
): AiPriceData {
  let distance: number;
  if (coords) {
    // Use coords for more realistic distance calculation from Istanbul center
    const centerLat = 41.0082;
    const centerLng = 28.9784;
    const dlat = coords.lat - centerLat;
    const dlng = coords.lng - centerLng;
    const rawDist = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    // Add dropoff entropy
    const entropy = (dropoff.length * 1.7) % 18;
    distance = Math.max(2, Math.min(30, rawDist + entropy + 3));
    distance = Math.round(distance * 10) / 10;
  } else {
    distance = ((dropoff.length * 2) % 30) + 2;
  }
  const duration = Math.round(distance * 3);
  const trafficIndex = Math.round(distance) % 3;
  const trafficLevel =
    trafficIndex === 0 ? "Low" : trafficIndex === 1 ? "Moderate" : "High";
  const trafficBonus =
    trafficLevel === "High" ? 450 : trafficLevel === "Moderate" ? 250 : 0;
  const rawPrice = 1000 + distance * 120 + duration * 3 + trafficBonus;
  const price = Math.min(2800, Math.max(800, Math.round(rawPrice)));
  return { price, distanceKm: distance, durationMin: duration, trafficLevel };
}

function AnimatedPrice({ target }: { target: number }) {
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

  return <span>₺{display}</span>;
}

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

  // Auto-detect passenger location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      setDetectedLocation({
        lat: 41.0082,
        lng: 28.9784,
        label: "ISTANBUL-41.0082°N",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setDetectedLocation({
          lat,
          lng,
          label: `${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`,
        });
        setLocationStatus("found");
      },
      () => {
        setLocationStatus("denied");
        setDetectedLocation({
          lat: 41.0082,
          lng: 28.9784,
          label: "ISTANBUL-41.0082°N",
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
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
      toast(msg, {
        style: {
          background: "rgba(168,85,255,0.15)",
          borderColor: "rgba(168,85,255,0.4)",
          color: "#e2d4ff",
        },
      });
    }, 15000);
    return () => {
      if (phantomRef.current) clearInterval(phantomRef.current);
    };
  }, [phantomMode, rideId]);

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
      const priceData = calcAiPrice(dropoffZone, detectedLocation);
      setAiPriceData(priceData);
      setRideStatus("pricing");
      toast.success("AI pricing calculated — review before approving");
    } catch {
      toast.error("Failed to create ride request");
    } finally {
      setLoading(false);
    }
  }, [actor, dropoffZone, phantomMode, session.sessionId, detectedLocation]);

  const handleApproveRide = useCallback(async () => {
    if (!actor || !rideId) return;
    setApproving(true);
    try {
      await actor.approveRide(rideId, session.sessionId);
      setRideStatus("searching");
      toast.success("Ride approved — searching for driver anonymously...");
    } catch {
      toast.error("Failed to approve ride");
    } finally {
      setApproving(false);
    }
  }, [actor, rideId, session.sessionId]);

  const handleCancelRide = useCallback(() => {
    setRideStatus("idle");
    setRideId(null);
    setSessionCode(null);
    setAiPriceData(null);
    toast("Ride cancelled");
  }, []);

  const handleConfirmCashPayment = useCallback(async () => {
    if (!actor || !rideId) return;
    try {
      await actor.updateRideStatus(rideId, session.sessionId, "completed");
    } catch {}
    toast.success("Cash payment confirmed — trust scores updated anonymously");
    setShowRating(true);
  }, [actor, rideId, session.sessionId]);

  const handleMoodSelect = (emoji: string) => {
    setSelectedMood(emoji);
    toast(`${emoji} Pulse signal sent to driver`);
    setTimeout(() => {
      toast("🤖 AI adjusting route for your mood...", {
        style: {
          background: "rgba(46,230,214,0.1)",
          borderColor: "rgba(46,230,214,0.3)",
          color: "#a7fffa",
        },
      });
    }, 1000);
  };

  const handleSubmitRating = useCallback(async () => {
    if (!actor || !rideId) return;
    try {
      await actor.submitRating(rideId, session.sessionId, BigInt(ratingStars));
      toast.success("Rating submitted anonymously");
      setShowRating(false);
    } catch {
      toast.error("Failed to submit rating");
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

  const accent = "#a855ff";

  const trafficColor = (level: string) =>
    level === "Low" ? "#22c55e" : level === "Moderate" ? "#f59e0b" : "#ef4444";

  if (sessionTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-10 text-center max-w-sm"
          style={{ borderColor: "rgba(168,85,255,0.3)" }}
        >
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-lg font-bold uppercase tracking-widest text-white mb-2">
            Session Terminated
          </h2>
          <p className="text-sm text-[#a7b0c2]">
            All temporary data wiped. You are anonymous.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-black uppercase tracking-widest"
              style={{ color: accent }}
            >
              RIDER DASHBOARD
            </h1>
            <p className="text-xs text-[#a7b0c2] mt-0.5">
              Session: {maskSession(session.sessionId)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#a7b0c2] font-mono">
              {formatTime(timer)}
            </div>
            <div
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(46,230,214,0.1)",
                border: "1px solid rgba(46,230,214,0.25)",
                color: "#2ee6d6",
              }}
            >
              <Lock className="w-3 h-3" /> All data encrypted
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndSession}
              className="text-xs text-[#a7b0c2] hover:text-red-400"
              data-ocid="rider.end_session.button"
            >
              <LogOut className="w-4 h-4 mr-1" /> End Session
            </Button>
          </div>
        </div>

        <KarmicScore sessionId={session.sessionId} userRole="rider" />

        {/* Reputation + Phantom mode toggle */}
        <div className="grid md:grid-cols-2 gap-4">
          <div
            className="glass-card rounded-xl p-4"
            style={{ borderColor: "rgba(168,85,255,0.2)" }}
            data-ocid="rider.reputation.card"
          >
            <p className="text-xs uppercase tracking-widest text-[#a7b0c2] mb-2">
              REPUTATION
            </p>
            {reputation ? (
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: "#2ee6d6" }} />
                <span className="font-bold text-white">{reputation[0]}</span>
                <span className="text-xs text-[#a7b0c2]">
                  • {reputation[1]} Successful Rides
                </span>
              </div>
            ) : (
              <div className="text-sm text-[#a7b0c2]">Loading...</div>
            )}
          </div>

          <div
            className="glass-card rounded-xl p-4"
            style={{
              borderColor: phantomMode
                ? "rgba(168,85,255,0.5)"
                : "rgba(168,85,255,0.2)",
              boxShadow: phantomMode ? "0 0 24px rgba(168,85,255,0.2)" : "none",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="w-5 h-5" style={{ color: accent }} />
                <Label className="font-bold text-white uppercase tracking-wider text-xs">
                  PHANTOM MODE
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
                className="mt-2 text-xs animate-phantom"
                style={{ color: "#c084fc" }}
              >
                👻 PHANTOM MODE ACTIVE — AI decoys broadcasting
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
              className="glass-card rounded-xl p-6"
              style={{ borderColor: "rgba(168,85,255,0.2)" }}
            >
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-white">
                REQUEST RIDE
              </h2>
              <div className="space-y-4">
                {/* GPS Auto-Detection Panel */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(0,255,136,0.05)",
                    border: `1px solid ${
                      locationStatus === "found"
                        ? "rgba(0,255,136,0.4)"
                        : locationStatus === "denied"
                          ? "rgba(239,68,68,0.35)"
                          : "rgba(0,255,136,0.2)"
                    }`,
                    boxShadow:
                      locationStatus === "found"
                        ? "0 0 16px rgba(0,255,136,0.08)"
                        : "none",
                  }}
                  data-ocid="rider.gps_location.panel"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin
                        className="w-4 h-4"
                        style={{
                          color:
                            locationStatus === "found"
                              ? "#00ff88"
                              : locationStatus === "denied"
                                ? "#ef4444"
                                : "#a7b0c2",
                        }}
                      />
                      <span className="text-xs font-bold uppercase tracking-widest text-[#a7b0c2]">
                        PICKUP LOCATION
                      </span>
                    </div>
                    {/* Status badge */}
                    {locationStatus === "detecting" && (
                      <div
                        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{
                          background: "rgba(245,158,11,0.12)",
                          border: "1px solid rgba(245,158,11,0.35)",
                          color: "#f59e0b",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full animate-ping inline-block"
                          style={{ background: "#f59e0b" }}
                        />
                        DETECTING
                      </div>
                    )}
                    {locationStatus === "found" && (
                      <div
                        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{
                          background: "rgba(0,255,136,0.12)",
                          border: "1px solid rgba(0,255,136,0.4)",
                          color: "#00ff88",
                        }}
                      >
                        ✓ GPS LOCKED
                      </div>
                    )}
                    {locationStatus === "denied" && (
                      <div
                        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{
                          background: "rgba(239,68,68,0.12)",
                          border: "1px solid rgba(239,68,68,0.35)",
                          color: "#f87171",
                        }}
                      >
                        ⚠ APPROX
                      </div>
                    )}
                  </div>

                  {/* Coordinates display */}
                  <div
                    className="font-mono text-sm tracking-wider"
                    style={{
                      color:
                        locationStatus === "found"
                          ? "#00ff88"
                          : locationStatus === "denied"
                            ? "#f87171"
                            : "#a7b0c2",
                    }}
                  >
                    {locationStatus === "detecting" ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full animate-spin border-2 border-t-transparent"
                          style={{
                            borderColor: "#f59e0b",
                            borderTopColor: "transparent",
                          }}
                        />
                        Acquiring GPS signal...
                      </span>
                    ) : (
                      <span>📍 {detectedLocation?.label}</span>
                    )}
                  </div>

                  {locationStatus === "denied" && (
                    <p className="text-[10px] text-[#a7b0c2] mt-1">
                      GPS unavailable — using approximate Istanbul location
                    </p>
                  )}
                </div>

                {/* Destination input */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#a7b0c2] mb-2 block">
                    DESTINATION ADDRESS
                  </Label>
                  <Input
                    value={dropoffZone}
                    onChange={(e) => setDropoffZone(e.target.value)}
                    placeholder="Enter destination (e.g. Taksim, Kadıköy, Airport)"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                    data-ocid="rider.dropoff_zone.input"
                  />
                </div>
                <Button
                  onClick={handleCalculatePrice}
                  disabled={loading || !dropoffZone.trim()}
                  className="btn-primary w-full rounded-full py-3 font-bold tracking-widest uppercase text-sm text-white"
                  data-ocid="rider.calculate_price.button"
                >
                  {loading ? "CALCULATING..." : "CALCULATE AI PRICE"}
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
              className="glass-card rounded-2xl p-6 relative overflow-hidden"
              style={{
                borderColor: "rgba(168,85,255,0.5)",
                boxShadow:
                  "0 0 40px rgba(168,85,255,0.15), 0 0 80px rgba(168,85,255,0.07)",
              }}
              data-ocid="rider.pricing_card"
            >
              {/* Animated glow border */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(168,85,255,0.06) 0%, rgba(46,230,214,0.04) 100%)",
                }}
              />

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                  AI PRICE ANALYSIS
                </h2>
                <motion.div
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(168,85,255,0.2)",
                    border: "1px solid rgba(168,85,255,0.5)",
                    color: "#c084fc",
                  }}
                >
                  <Zap className="w-3 h-3" /> AI POWERED
                </motion.div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div
                  className="text-center p-3 rounded-xl"
                  style={{
                    background: "rgba(46,230,214,0.06)",
                    border: "1px solid rgba(46,230,214,0.15)",
                  }}
                >
                  <p className="text-[10px] text-[#a7b0c2] uppercase tracking-wider mb-1">
                    DISTANCE
                  </p>
                  <p className="text-lg font-black text-white">
                    {aiPriceData.distanceKm}
                  </p>
                  <p className="text-[10px] text-[#a7b0c2]">km</p>
                </div>
                <div
                  className="text-center p-3 rounded-xl"
                  style={{
                    background: "rgba(46,230,214,0.06)",
                    border: "1px solid rgba(46,230,214,0.15)",
                  }}
                >
                  <p className="text-[10px] text-[#a7b0c2] uppercase tracking-wider mb-1">
                    DURATION
                  </p>
                  <p className="text-lg font-black text-white">
                    {aiPriceData.durationMin}
                  </p>
                  <p className="text-[10px] text-[#a7b0c2]">min</p>
                </div>
                <div
                  className="text-center p-3 rounded-xl"
                  style={{
                    background: "rgba(46,230,214,0.06)",
                    border: "1px solid rgba(46,230,214,0.15)",
                  }}
                >
                  <p className="text-[10px] text-[#a7b0c2] uppercase tracking-wider mb-1">
                    TRAFFIC
                  </p>
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1"
                    style={{
                      background: `${trafficColor(aiPriceData.trafficLevel)}20`,
                      color: trafficColor(aiPriceData.trafficLevel),
                      border: `1px solid ${trafficColor(aiPriceData.trafficLevel)}40`,
                    }}
                  >
                    {aiPriceData.trafficLevel}
                  </span>
                </div>
              </div>

              {/* Phantom experience line */}
              {phantomMode && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg"
                  style={{
                    background: "rgba(168,85,255,0.1)",
                    border: "1px solid rgba(168,85,255,0.3)",
                  }}
                >
                  <Ghost className="w-4 h-4" style={{ color: "#c084fc" }} />
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{
                      color: "#c084fc",
                      textShadow: "0 0 10px rgba(168,85,255,0.6)",
                    }}
                  >
                    + PHANTOM EXPERIENCE ACTIVE
                  </span>
                </motion.div>
              )}

              {/* Price display */}
              <div className="text-center py-4 mb-5">
                <p className="text-xs uppercase tracking-widest text-[#a7b0c2] mb-2">
                  RECOMMENDED CASH PRICE
                </p>
                <motion.div
                  animate={{
                    textShadow: [
                      "0 0 20px rgba(168,85,255,0.4)",
                      "0 0 40px rgba(168,85,255,0.7)",
                      "0 0 20px rgba(168,85,255,0.4)",
                    ],
                  }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  className="text-5xl font-black tracking-tight"
                  style={{ color: "#c084fc" }}
                >
                  <AnimatedPrice target={aiPriceData.price} />
                </motion.div>
                <p className="text-xs text-[#a7b0c2] mt-1">
                  Turkish Lira · Cash at destination
                </p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button
                  onClick={handleApproveRide}
                  disabled={approving}
                  className="rounded-full py-3 font-bold tracking-widest uppercase text-sm text-black"
                  style={{
                    background: approving
                      ? "rgba(46,230,214,0.4)"
                      : "linear-gradient(135deg, #2ee6d6, #3be7ff)",
                    boxShadow: "0 0 20px rgba(46,230,214,0.3)",
                  }}
                  data-ocid="rider.approve_ride.button"
                >
                  {approving ? "APPROVING..." : "APPROVE & FIND DRIVER"}
                </Button>
                <Button
                  onClick={handleCancelRide}
                  variant="ghost"
                  className="rounded-full py-3 font-bold tracking-widest uppercase text-sm"
                  style={{
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#f87171",
                  }}
                  data-ocid="rider.cancel_ride.button"
                >
                  CANCEL RIDE
                </Button>
              </div>

              {/* Disclaimer */}
              <p className="text-center text-[10px] text-[#a7b0c2]">
                Ride begins only after your approval • Cash payment at
                destination
              </p>
            </motion.div>
          )}

          {/* Searching / In-Ride status */}
          {(rideStatus === "searching" || rideStatus === "active") && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card rounded-xl p-6 animate-border-glow"
              style={{ borderColor: "rgba(168,85,255,0.3)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                  RIDE STATUS
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: accent }}
                    />
                    <div
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: accent, opacity: 0.5 }}
                    />
                  </div>
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: accent }}
                  >
                    SEARCHING FOR DRIVER...
                  </span>
                </div>
              </div>
              {sessionCode && (
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="text-center p-3 rounded-lg"
                    style={{
                      background: "rgba(168,85,255,0.08)",
                      border: "1px solid rgba(168,85,255,0.2)",
                    }}
                  >
                    <p className="text-xs text-[#a7b0c2] mb-1">RIDE ID</p>
                    <p
                      className="text-xs font-mono font-bold"
                      style={{ color: accent }}
                    >
                      {maskSession(rideId ?? "")}
                    </p>
                  </div>
                  <div
                    className="text-center p-3 rounded-lg"
                    style={{
                      background: "rgba(168,85,255,0.08)",
                      border: "1px solid rgba(168,85,255,0.2)",
                    }}
                  >
                    <p className="text-xs text-[#a7b0c2] mb-1">AGREED PRICE</p>
                    <p
                      className="text-xs font-mono font-bold"
                      style={{ color: "#2ee6d6" }}
                    >
                      {aiPriceData ? `₺${aiPriceData.price}` : sessionCode}
                    </p>
                  </div>
                </div>
              )}
              {onLiveMap && (
                <button
                  onClick={onLiveMap}
                  className="w-full mt-3 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                  style={{
                    background: "rgba(0,255,136,0.1)",
                    border: "1px solid rgba(0,255,136,0.4)",
                    color: "#00ff88",
                  }}
                  type="button"
                  data-ocid="rider.live_map.button"
                >
                  🗺️ LIVE MAP
                </button>
              )}
              {onGhostDuello && aiPriceData && (
                <button
                  type="button"
                  onClick={() => onGhostDuello(aiPriceData.price)}
                  className="w-full mt-2 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                  style={{
                    background: "rgba(255,69,0,0.1)",
                    border: "1px solid rgba(255,69,0,0.4)",
                    color: "#ff4500",
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
                  className="w-full mt-2 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                  style={{
                    background: "rgba(168,85,247,0.1)",
                    border: "1px solid rgba(168,85,247,0.4)",
                    color: "#a855ff",
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
                  className="w-full mt-2 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                  style={{
                    background: "rgba(168,85,255,0.1)",
                    border: "1px solid rgba(168,85,255,0.4)",
                    color: "#a855ff",
                  }}
                  data-ocid="rider.ghost_chat.button"
                >
                  💬 GHOST CHAT
                </button>
              )}
            </motion.div>
          )}

          {/* Completed — Cash Payment Screen */}
          {rideStatus === "completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card rounded-2xl p-8 text-center"
              style={{
                borderColor: "rgba(46,230,214,0.4)",
                boxShadow: "0 0 40px rgba(46,230,214,0.1)",
              }}
            >
              <div className="text-5xl mb-4">🏁</div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white mb-2">
                RIDE COMPLETE
              </h2>
              <p
                className="text-sm uppercase tracking-widest mb-6"
                style={{ color: "#2ee6d6" }}
              >
                PAY DRIVER IN CASH
              </p>
              {aiPriceData && (
                <div
                  className="inline-block px-8 py-4 rounded-2xl mb-6"
                  style={{
                    background: "rgba(46,230,214,0.08)",
                    border: "1px solid rgba(46,230,214,0.3)",
                  }}
                >
                  <p className="text-xs text-[#a7b0c2] uppercase tracking-widest mb-1">
                    AGREED AMOUNT
                  </p>
                  <p
                    className="text-4xl font-black"
                    style={{ color: "#2ee6d6" }}
                  >
                    ₺{aiPriceData.price}
                  </p>
                </div>
              )}
              <Button
                onClick={handleConfirmCashPayment}
                className="w-full rounded-full py-3 font-bold tracking-widest uppercase text-sm text-black mb-3"
                style={{
                  background: "linear-gradient(135deg, #2ee6d6, #3be7ff)",
                  boxShadow: "0 0 20px rgba(46,230,214,0.3)",
                }}
                data-ocid="rider.confirm_cash_payment.button"
              >
                CONFIRM CASH PAYMENT
              </Button>
              <p className="text-xs text-[#a7b0c2]">
                🔒 Trust scores updated anonymously • No payment data stored
                <Button
                  onClick={() => setShowSnapshot(true)}
                  variant="ghost"
                  className="w-full mt-2 rounded-full py-2.5 font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2"
                  style={{
                    background: "rgba(168,85,255,0.1)",
                    border: "1px solid rgba(168,85,255,0.3)",
                    color: "#c084fc",
                  }}
                  data-ocid="rider.share_snapshot.button"
                >
                  <Share2 className="w-4 h-4" /> SHARE RIDE SNAPSHOT
                </Button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse Mood Bar */}
        <div
          className="glass-card rounded-xl p-5"
          style={{ borderColor: "rgba(46,230,214,0.15)" }}
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#a7b0c2] mb-3">
            PULSE MOOD BAR
          </h2>
          <div className="flex gap-2">
            {MOODS.map(({ emoji, label }) => (
              <button
                type="button"
                key={label}
                onClick={() => handleMoodSelect(emoji)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all text-sm"
                style={{
                  background:
                    selectedMood === emoji
                      ? "rgba(46,230,214,0.15)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    selectedMood === emoji
                      ? "rgba(46,230,214,0.5)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                  boxShadow:
                    selectedMood === emoji
                      ? "0 0 12px rgba(46,230,214,0.25)"
                      : "none",
                }}
                data-ocid={`rider.mood_${label.toLowerCase()}.button`}
              >
                <span className="text-lg">{emoji}</span>
                <span className="text-[10px] text-[#a7b0c2]">{label}</span>
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
          className="glass-card border-purple-500/30 text-white"
          data-ocid="rider.rating.dialog"
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm">
              RATE YOUR RIDE
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
                    color: s <= ratingStars ? "#f5c84b" : "#374151",
                    fill: s <= ratingStars ? "#f5c84b" : "transparent",
                  }}
                />
              </button>
            ))}
          </div>
          <Button
            onClick={handleSubmitRating}
            className="btn-primary w-full rounded-full text-white font-bold tracking-widest uppercase"
            data-ocid="rider.rating.submit_button"
          >
            SUBMIT RATING
          </Button>
        </DialogContent>
      </Dialog>

      {/* Viral Snapshot Modal */}
      <Dialog open={showSnapshot} onOpenChange={setShowSnapshot}>
        <DialogContent
          className="glass-card border-purple-500/30 text-white max-w-sm"
          data-ocid="rider.snapshot.dialog"
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
              <span>🔥</span> VIRAL SNAPSHOT
            </DialogTitle>
          </DialogHeader>
          <div
            className="rounded-2xl p-5 text-center relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(168,85,255,0.15) 0%, rgba(46,230,214,0.08) 100%)",
              border: "1px solid rgba(168,85,255,0.3)",
            }}
          >
            <div
              className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
              style={{
                background: "rgba(46,230,214,0.15)",
                border: "1px solid rgba(46,230,214,0.4)",
                color: "#2ee6d6",
              }}
            >
              GENERATED BY AI
            </div>
            <div className="text-4xl mb-2">👤</div>
            <p
              className="text-xs font-black tracking-widest mb-3"
              style={{ color: "#a855ff" }}
            >
              GHOST-{session.sessionId.slice(-4).toUpperCase()}
            </p>
            {aiPriceData && (
              <div className="flex justify-center gap-6 mb-4">
                <div>
                  <p className="text-lg font-black text-white">
                    {aiPriceData.distanceKm}
                  </p>
                  <p className="text-[10px] text-[#a7b0c2] uppercase">km</p>
                </div>
                <div>
                  <p className="text-lg font-black text-white">
                    {aiPriceData.durationMin}
                  </p>
                  <p className="text-[10px] text-[#a7b0c2] uppercase">min</p>
                </div>
                <div>
                  <p className="text-xl">{selectedMood ?? "⚡"}</p>
                  <p className="text-[10px] text-[#a7b0c2] uppercase">mood</p>
                </div>
              </div>
            )}
            <div className="flex items-end justify-center gap-0.5 h-6 mb-4">
              {[..."0123456789ab"].map((id, j) => (
                <div
                  key={id}
                  className="w-1 rounded-full animate-waveform"
                  style={{
                    height: `${((j % 4) + 1) * 5}px`,
                    background: "linear-gradient(to top, #2ee6d6, #a855ff)",
                    animationDelay: `${j * 0.07}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {[
              { label: "TikTok", color: "#ff0050" },
              { label: "Reels", color: "#e040fb" },
              { label: "Shorts", color: "#ff0000" },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(
                      `PulseRide #GHOST-${session.sessionId.slice(-4).toUpperCase()} — Anonim s\xfcr\xfc\u015f! #PulseRide #ViralMod`,
                    )
                    .then(() => {
                      const { toast: t } = require("sonner");
                      t.success("Anonim link kopyaland\u0131! 🔗");
                    });
                }}
                className="flex-1 text-[10px] font-bold py-2 rounded-full uppercase tracking-wider"
                style={{
                  background: `${p.color}22`,
                  border: `1px solid ${p.color}55`,
                  color: p.color,
                }}
                data-ocid="rider.snapshot.button"
              >
                {p.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
