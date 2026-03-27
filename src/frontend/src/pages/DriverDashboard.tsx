import type { SessionState } from "@/App";
import KarmicScore from "@/components/KarmicScore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useActor } from "@/hooks/useActor";
import { Ghost, Lock, LogOut, Navigation, Send, Star, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface DriverDashboardProps {
  session: SessionState;
  onEndSession: () => void;
  onLiveMap?: () => void;
}

interface AvailableRide {
  rideId: string;
  sessionCode: string;
  isPhantom: boolean;
  riderTrust: string;
  aiPrice: number;
  distanceKm: number;
  durationMin: number;
  trafficLevel: string;
}

const NAV_STEPS = [
  "Head north on encrypted route A7 for 0.4mi",
  "Turn right at checkpoint B3",
  "Continue on secure corridor Gamma-2 for 0.8mi",
  "Merge onto encrypted bypass route X9",
  "Arrive at anonymized pickup zone — 250ft ahead",
];

const PULSE_EVENTS = [
  {
    type: "trivia" as const,
    question:
      "Which encryption standard is used in modern secure communications?",
    options: ["AES-256", "MD5", "SHA-1", "Base64"],
    answer: 0,
  },
  {
    type: "trivia" as const,
    question: "What does 'zero-knowledge proof' mean?",
    options: [
      "No proof needed",
      "Proving knowledge without revealing it",
      "Encrypted storage",
      "Anonymous voting",
    ],
    answer: 1,
  },
  {
    type: "ambient" as const,
    message: "🛡️ You're traveling through encrypted corridor Alpha-7",
  },
  {
    type: "fact" as const,
    message:
      "💡 Privacy fact: 93% of data breaches involve identity-linked records. You're protected.",
  },
  {
    type: "ambient" as const,
    message: "🌐 AI route optimization active — 3 phantom decoys deployed",
  },
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

function trafficColor(level: string): string {
  return level === "Low"
    ? "#22c55e"
    : level === "Moderate"
      ? "#f59e0b"
      : "#ef4444";
}

export default function DriverDashboard({
  session,
  onEndSession,
  onLiveMap,
}: DriverDashboardProps) {
  const { actor } = useActor();
  const [reputation, setReputation] = useState<[string, number] | null>(null);
  const [rides, setRides] = useState<AvailableRide[]>([]);
  const [activeRide, setActiveRide] = useState<AvailableRide | null>(null);
  const [navStep, setNavStep] = useState(0);
  const [routeProgress, setRouteProgress] = useState(0);
  const [messages, setMessages] = useState<
    Array<{ sender: string; text: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [pulseEvent, setPulseEvent] = useState<
    (typeof PULSE_EVENTS)[number] | null
  >(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [sessionTerminated, setSessionTerminated] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeProgressRef = useRef(routeProgress);
  routeProgressRef.current = routeProgress;

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
    if (!actor || activeRide) return;
    const poll = () => {
      actor
        .listAvailableRides()
        .then((list) => {
          setRides(
            list.map(
              ([
                rideId,
                sessionCode,
                isPhantom,
                riderTrust,
                aiPrice,
                distanceKm,
                durationMin,
                trafficLevel,
              ]) => ({
                rideId,
                sessionCode,
                isPhantom,
                riderTrust,
                aiPrice: Number(aiPrice),
                distanceKm: Number(distanceKm),
                durationMin: Number(durationMin),
                trafficLevel,
              }),
            ),
          );
        })
        .catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [actor, activeRide]);

  useEffect(() => {
    if (!actor || !activeRide) return;
    const poll = () => {
      actor
        .getMessages(activeRide.rideId, session.sessionId)
        .then((msgs) => {
          setMessages(msgs.map(([sender, text]) => ({ sender, text })));
        })
        .catch(() => {});
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [actor, activeRide, session.sessionId]);

  useEffect(() => {
    if (!activeRide) return;
    eventRef.current = setInterval(() => {
      const event =
        PULSE_EVENTS[Math.floor(Math.random() * PULSE_EVENTS.length)];
      setPulseEvent(event);
      setSelectedAnswer(null);
    }, 20000);
    return () => {
      if (eventRef.current) clearInterval(eventRef.current);
    };
  }, [activeRide]);

  useEffect(() => {
    if (!activeRide) return;
    const interval = setInterval(() => {
      setRouteProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = p + 1;
        if (next > 0 && next % 20 === 0) {
          setNavStep((s) => Math.min(s + 1, NAV_STEPS.length - 1));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRide]);

  const handleAcceptRide = useCallback(
    async (ride: AvailableRide) => {
      if (!actor) return;
      try {
        await actor.acceptRide(ride.rideId, session.sessionId);
        setActiveRide(ride);
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success("Ride accepted — AI navigation activated");
      } catch {
        toast.error("Failed to accept ride");
      }
    },
    [actor, session.sessionId],
  );

  const handleCompleteRide = useCallback(async () => {
    if (!actor || !activeRide) return;
    try {
      await actor.updateRideStatus(
        activeRide.rideId,
        session.sessionId,
        "completed",
      );
      setShowRating(true);
    } catch {
      toast.error("Failed to complete ride");
    }
  }, [actor, activeRide, session.sessionId]);

  const handleSendMessage = useCallback(async () => {
    if (!actor || !activeRide || !chatInput.trim()) return;
    try {
      await actor.sendMessage(activeRide.rideId, session.sessionId, chatInput);
      setChatInput("");
    } catch {
      toast.error("Failed to send message");
    }
  }, [actor, activeRide, chatInput, session.sessionId]);

  const handleSubmitRating = useCallback(async () => {
    if (!actor || !activeRide) return;
    try {
      await actor.submitRating(
        activeRide.rideId,
        session.sessionId,
        BigInt(ratingStars),
      );
      toast.success("Rating submitted");
      setShowRating(false);
      setActiveRide(null);
      setRouteProgress(0);
      setNavStep(0);
    } catch {
      toast.error("Failed to submit rating");
    }
  }, [actor, activeRide, ratingStars, session.sessionId]);

  const handleEndSession = useCallback(async () => {
    if (!actor) return;
    try {
      await actor.endSession(session.sessionId);
    } catch {}
    setSessionTerminated(true);
    setTimeout(onEndSession, 2500);
  }, [actor, session.sessionId, onEndSession]);

  const accent = "#2ee6d6";

  if (sessionTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-10 text-center max-w-sm"
          style={{ borderColor: "rgba(46,230,214,0.3)" }}
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
              DRIVER DASHBOARD
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
              data-ocid="driver.end_session.button"
            >
              <LogOut className="w-4 h-4 mr-1" /> End Session
            </Button>
          </div>
        </div>

        {/* Reputation */}
        <div
          className="glass-card rounded-xl p-4"
          style={{ borderColor: "rgba(46,230,214,0.2)" }}
          data-ocid="driver.reputation.card"
        >
          <p className="text-xs uppercase tracking-widest text-[#a7b0c2] mb-2">
            REPUTATION
          </p>
          {reputation ? (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: "#2ee6d6" }} />
              <span className="font-bold text-white">{reputation[0]}</span>
              <span className="text-xs text-[#a7b0c2]">
                • {reputation[1]} Successful Rides
              </span>
            </div>
          ) : (
            <div className="text-sm text-[#a7b0c2]">Loading...</div>
          )}
        </div>

        {/* Available Rides or In-Ride */}
        {!activeRide ? (
          <div
            className="glass-card rounded-xl overflow-hidden"
            style={{ borderColor: "rgba(46,230,214,0.2)" }}
          >
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                AVAILABLE RIDES
              </h2>
              <div
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "#2ee6d6" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#2ee6d6" }}
                />
                Live
              </div>
            </div>
            <div className="p-4 space-y-3">
              {rides.length === 0 ? (
                <div
                  className="text-center py-10 text-[#a7b0c2] text-sm"
                  data-ocid="driver.rides.empty_state"
                >
                  <Navigation className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  Scanning for ride requests...
                </div>
              ) : (
                rides.map((ride, index) => (
                  <motion.div
                    key={ride.rideId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl"
                    style={{
                      background: ride.isPhantom
                        ? "rgba(168,85,255,0.08)"
                        : "rgba(46,230,214,0.05)",
                      border: `1px solid ${
                        ride.isPhantom
                          ? "rgba(168,85,255,0.3)"
                          : "rgba(46,230,214,0.2)"
                      }`,
                      boxShadow: ride.isPhantom
                        ? "0 0 16px rgba(168,85,255,0.12)"
                        : "none",
                    }}
                    data-ocid={`driver.ride.item.${index + 1}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {ride.isPhantom && (
                          <Ghost
                            className="w-5 h-5 animate-phantom"
                            style={{ color: "#a855ff" }}
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-white">
                              {ride.sessionCode}
                            </span>
                            {ride.isPhantom && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                                style={{
                                  background: "rgba(168,85,255,0.2)",
                                  color: "#c084fc",
                                  border: "1px solid rgba(168,85,255,0.3)",
                                }}
                              >
                                PHANTOM
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] text-[#a7b0c2]">
                              Trust:{" "}
                              <span style={{ color: accent }}>
                                {ride.riderTrust || "Unknown"}
                              </span>
                            </p>
                            <p className="text-[10px] text-[#a7b0c2]">
                              {ride.distanceKm} km • {ride.durationMin} min
                            </p>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                              style={{
                                background: `${trafficColor(ride.trafficLevel)}15`,
                                color: trafficColor(ride.trafficLevel),
                                border: `1px solid ${trafficColor(ride.trafficLevel)}35`,
                              }}
                            >
                              {ride.trafficLevel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p
                            className="text-xl font-black"
                            style={{ color: accent }}
                          >
                            ₺{ride.aiPrice}
                          </p>
                          <p className="text-[10px] text-[#a7b0c2]">cash</p>
                        </div>
                        <Button
                          onClick={() => handleAcceptRide(ride)}
                          size="sm"
                          className="btn-secondary text-xs font-bold tracking-wider uppercase rounded-full px-4"
                          data-ocid={`driver.accept_ride.button.${index + 1}`}
                        >
                          ACCEPT
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* In-Ride View */
          <>
            <KarmicScore sessionId={session.sessionId} userRole="driver" />

            <div className="space-y-4">
              {/* Active ride price banner */}
              <div
                className="glass-card rounded-xl p-4 flex items-center justify-between"
                style={{
                  borderColor: "rgba(46,230,214,0.3)",
                  background: "rgba(46,230,214,0.04)",
                }}
              >
                <div>
                  <p className="text-[10px] text-[#a7b0c2] uppercase tracking-widest">
                    AGREED FARE
                  </p>
                  <p className="text-2xl font-black" style={{ color: accent }}>
                    ₺{activeRide.aiPrice}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#a7b0c2]">
                    {activeRide.distanceKm} km • {activeRide.durationMin} min
                  </p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{
                      background: `${trafficColor(activeRide.trafficLevel)}15`,
                      color: trafficColor(activeRide.trafficLevel),
                      border: `1px solid ${trafficColor(activeRide.trafficLevel)}35`,
                    }}
                  >
                    {activeRide.trafficLevel} TRAFFIC
                  </span>
                </div>
              </div>

              <div
                className="glass-card rounded-xl p-4 animate-border-glow"
                style={{ borderColor: "rgba(46,230,214,0.3)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-5 h-5" style={{ color: accent }} />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                      AI NAVIGATION ACTIVE
                    </h2>
                  </div>
                  {activeRide.isPhantom && (
                    <div
                      className="flex items-center gap-1.5 text-xs animate-phantom"
                      style={{ color: "#a855ff" }}
                    >
                      <Ghost className="w-4 h-4" />
                      PHANTOM PASSENGER
                    </div>
                  )}
                </div>
                <Progress value={routeProgress} className="h-1.5 mb-3" />
                <div className="space-y-2">
                  {NAV_STEPS.map((step, i) => (
                    <div
                      key={step}
                      className={`flex items-center gap-2 text-xs transition-all ${
                        i === navStep
                          ? "text-white"
                          : i < navStep
                            ? "text-[#a7b0c2] line-through opacity-50"
                            : "text-[#a7b0c2] opacity-30"
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background:
                            i <= navStep ? `${accent}20` : "transparent",
                          border: `1px solid ${
                            i <= navStep ? accent : "rgba(255,255,255,0.1)"
                          }`,
                        }}
                      >
                        {i < navStep ? (
                          <span style={{ color: accent, fontSize: "9px" }}>
                            ✓
                          </span>
                        ) : i === navStep ? (
                          <div
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{ background: accent }}
                          />
                        ) : null}
                      </div>
                      {step}
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button
                    onClick={handleCompleteRide}
                    className="w-full btn-secondary rounded-full font-bold tracking-widest uppercase text-xs"
                    data-ocid="driver.complete_ride.primary_button"
                  >
                    COMPLETE RIDE
                  </Button>
                  {onLiveMap && (
                    <button
                      onClick={onLiveMap}
                      className="w-full mt-2 py-3 font-mono font-black text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95"
                      style={{
                        background: "rgba(0,255,255,0.1)",
                        border: "1px solid rgba(0,255,255,0.4)",
                        color: "#00ffff",
                      }}
                      type="button"
                      data-ocid="driver.track_ride.button"
                    >
                      🗺️ TRACK RIDE
                    </button>
                  )}
                </div>
              </div>

              {/* Pulse Event */}
              <AnimatePresence>
                {pulseEvent && (
                  <motion.div
                    key={pulseEvent.type}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="glass-card rounded-xl p-5"
                    style={{ borderColor: "rgba(168,85,255,0.3)" }}
                  >
                    {pulseEvent.type === "trivia" ? (
                      <div>
                        <p
                          className="text-xs font-bold uppercase tracking-widest mb-3"
                          style={{ color: "#a855ff" }}
                        >
                          ⚡ PULSE TRIVIA
                        </p>
                        <p className="text-sm text-white mb-3">
                          {pulseEvent.question}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {pulseEvent.options.map((opt, i) => (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => setSelectedAnswer(i)}
                              className="text-left text-xs px-3 py-2 rounded-lg transition-all"
                              style={{
                                background:
                                  selectedAnswer === i
                                    ? i === pulseEvent.answer
                                      ? "rgba(46,230,214,0.2)"
                                      : "rgba(255,80,80,0.15)"
                                    : "rgba(255,255,255,0.05)",
                                border: `1px solid ${
                                  selectedAnswer === i
                                    ? i === pulseEvent.answer
                                      ? "#2ee6d6"
                                      : "#ff5050"
                                    : "rgba(255,255,255,0.1)"
                                }`,
                                color:
                                  selectedAnswer === i
                                    ? i === pulseEvent.answer
                                      ? "#2ee6d6"
                                      : "#ff8080"
                                    : "#a7b0c2",
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#a7b0c2]">
                        {pulseEvent.message}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setPulseEvent(null)}
                      className="mt-3 text-[10px] text-[#a7b0c2] hover:text-white"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat */}
              <div
                className="glass-card rounded-xl overflow-hidden"
                style={{ borderColor: "rgba(46,230,214,0.2)" }}
              >
                <div className="px-5 py-3 border-b border-white/5">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
                    <Lock
                      className="w-3.5 h-3.5"
                      style={{ color: "#2ee6d6" }}
                    />
                    ENCRYPTED CHANNEL
                  </h2>
                </div>
                <div className="h-36 overflow-y-auto p-4 space-y-2">
                  {messages.length === 0 ? (
                    <p
                      className="text-xs text-[#a7b0c2] text-center py-4"
                      data-ocid="driver.chat.empty_state"
                    >
                      No messages yet
                    </p>
                  ) : (
                    messages.map((msg, i) => (
                      <div
                        key={msg.text + String(i)}
                        className={`text-xs px-3 py-1.5 rounded-lg max-w-[80%] ${
                          msg.sender === session.sessionId
                            ? "ml-auto bg-cyan-500/15 text-cyan-200"
                            : "bg-purple-500/10 text-purple-200"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-3 border-t border-white/5 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Encrypted message..."
                    className="flex-1 bg-white/5 border-white/10 text-white text-xs placeholder:text-white/30"
                    data-ocid="driver.chat.input"
                  />
                  <Button
                    onClick={handleSendMessage}
                    size="sm"
                    className="btn-primary text-white px-3"
                    data-ocid="driver.chat.submit_button"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <Dialog open={showRating} onOpenChange={setShowRating}>
        <DialogContent
          className="glass-card border-cyan-500/30 text-white"
          data-ocid="driver.rating.dialog"
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm">
              RATE YOUR RIDER
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setRatingStars(s)}
                data-ocid={`driver.rating.star.${s}`}
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
            className="w-full rounded-full font-bold tracking-widest uppercase"
            style={{
              background: "linear-gradient(135deg, #2ee6d6, #3be7ff)",
              color: "#060812",
            }}
            data-ocid="driver.rating.submit_button"
          >
            SUBMIT RATING
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
