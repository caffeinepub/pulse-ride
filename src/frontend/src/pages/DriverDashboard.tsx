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
import { Progress } from "@/components/ui/progress";
import { useActor } from "@/hooks/useActor";
import { Ghost, Lock, LogOut, Navigation, Star, Zap } from "lucide-react";
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
  "A7 şifreli güzergah üzerinde 0.4km kuzeye gidin",
  "B3 kontrol noktasında sağa dönün",
  "Gamma-2 güvenli koridorunda 0.8km ilerleyin",
  "X9 şifreli bypass güzergahına katılın",
  "Anonim alış noktasına varış — 250m ileride",
];

const PULSE_EVENTS = [
  {
    type: "trivia" as const,
    question: "Modern güvenli iletişimde hangi şifreleme standardı kullanılır?",
    options: ["AES-256", "MD5", "SHA-1", "Base64"],
    answer: 0,
  },
  {
    type: "trivia" as const,
    question: "'Sıfır bilgi kanıtı' ne anlama gelir?",
    options: [
      "Kanıt gerekmez",
      "Bilgiyi ifşa etmeden kanıtlamak",
      "Şifreli depolama",
      "Anonim oylama",
    ],
    answer: 1,
  },
  {
    type: "ambient" as const,
    message: "🛡️ Alpha-7 şifreli koridordan geçiyorsunuz",
  },
  {
    type: "fact" as const,
    message:
      "💡 Gizlilik gerçeği: Veri ihlallerinin %93'ü kimlikle bağlantılı kayıtları içeriyor. Siz koruma altındasınız.",
  },
  {
    type: "ambient" as const,
    message: "🌐 AI rota optimizasyonu aktif — 3 phantom tuzağı yayınlanıyor",
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
    ? "#05944F"
    : level === "Moderate"
      ? "#f59e0b"
      : "#E11900";
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
  const [showGhostChat, setShowGhostChat] = useState(false);
  const [navStep, setNavStep] = useState(0);
  const [routeProgress, setRouteProgress] = useState(0);
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
        if (next > 0 && next % 20 === 0)
          setNavStep((s) => Math.min(s + 1, NAV_STEPS.length - 1));
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
        toast.success("Yolculuk kabul edildi — AI navigasyonu aktif");
      } catch {
        toast.error("Yolculuk kabul edilemedi");
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
      toast.error("Yolculuk tamamlanamadı");
    }
  }, [actor, activeRide, session.sessionId]);

  const handleSubmitRating = useCallback(async () => {
    if (!actor || !activeRide) return;
    try {
      await actor.submitRating(
        activeRide.rideId,
        session.sessionId,
        BigInt(ratingStars),
      );
      toast.success("Değerlendirme gönderildi");
      setShowRating(false);
      setActiveRide(null);
      setRouteProgress(0);
      setNavStep(0);
    } catch {
      toast.error("Değerlendirme gönderilemedi");
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
      <div className="uber-header px-5 py-4" data-ocid="driver.header.panel">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">
              ŞOFÖR PANELİ
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
              data-ocid="driver.end_session.button"
            >
              <LogOut className="w-4 h-4 mr-1" /> Çıkış
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-2xl mx-auto space-y-4">
        {/* Reputation */}
        <div
          className="uber-card rounded-xl p-4"
          data-ocid="driver.reputation.card"
        >
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            ÜNVAN
          </p>
          {reputation ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" style={{ color: "#276EF1" }} />
                <span className="font-bold text-[#141414]">
                  {reputation[0]}
                </span>
                <span className="text-xs text-gray-400">
                  • {reputation[1]} yolculuk
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Yükleniyor...</div>
          )}
        </div>

        {/* Available Rides or In-Ride */}
        {!activeRide ? (
          <div className="uber-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#141414] uppercase tracking-wide">
                MEVCUT YOLCULUKLAR
              </h2>
              <div
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "#276EF1" }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#276EF1]" />
                Canlı
              </div>
            </div>
            <div className="p-4 space-y-3">
              {rides.length === 0 ? (
                <div
                  className="text-center py-10 text-gray-400 text-sm"
                  data-ocid="driver.rides.empty_state"
                >
                  <Navigation className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  Yolculuk talepleri taranıyor...
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
                        ? "rgba(124,58,237,0.05)"
                        : "#FAFAFA",
                      border: `1px solid ${ride.isPhantom ? "rgba(124,58,237,0.25)" : "#E5E7EB"}`,
                    }}
                    data-ocid={`driver.ride.item.${index + 1}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {ride.isPhantom && (
                          <Ghost
                            className="w-5 h-5"
                            style={{ color: "#7C3AED" }}
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-[#141414]">
                              {ride.sessionCode}
                            </span>
                            {ride.isPhantom && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                style={{
                                  background: "rgba(124,58,237,0.1)",
                                  color: "#7C3AED",
                                  border: "1px solid rgba(124,58,237,0.2)",
                                }}
                              >
                                PHANTOM
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] text-gray-500">
                              Güven:{" "}
                              <span style={{ color: "#276EF1" }}>
                                {ride.riderTrust || "Bilinmiyor"}
                              </span>
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {ride.distanceKm} km · {ride.durationMin} dk
                            </p>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                              style={{
                                background: `${trafficColor(ride.trafficLevel)}12`,
                                color: trafficColor(ride.trafficLevel),
                                border: `1px solid ${trafficColor(ride.trafficLevel)}25`,
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
                            style={{ color: "#276EF1" }}
                          >
                            ₺{ride.aiPrice}
                          </p>
                          <p className="text-[10px] text-gray-400">nakit</p>
                        </div>
                        <Button
                          onClick={() => handleAcceptRide(ride)}
                          size="sm"
                          className="text-xs font-bold tracking-wide uppercase rounded-xl px-4 text-white"
                          style={{ background: "#276EF1" }}
                          data-ocid={`driver.accept_ride.button.${index + 1}`}
                        >
                          KABUL ET
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

            {/* Active ride price banner */}
            <div
              className="uber-card rounded-xl p-4 flex items-center justify-between"
              style={{
                borderColor: "rgba(39,110,241,0.2)",
                background: "rgba(39,110,241,0.03)",
              }}
            >
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  ANLAŞILAN ÜCRET
                </p>
                <p className="text-2xl font-black" style={{ color: "#276EF1" }}>
                  ₺{activeRide.aiPrice}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500">
                  {activeRide.distanceKm} km · {activeRide.durationMin} dk
                </p>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                  style={{
                    background: `${trafficColor(activeRide.trafficLevel)}12`,
                    color: trafficColor(activeRide.trafficLevel),
                    border: `1px solid ${trafficColor(activeRide.trafficLevel)}25`,
                  }}
                >
                  {activeRide.trafficLevel} TRAFİK
                </span>
              </div>
            </div>

            {/* Navigation */}
            <div
              className="uber-card rounded-xl p-4"
              style={{ borderColor: "rgba(39,110,241,0.2)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Navigation
                    className="w-5 h-5"
                    style={{ color: "#276EF1" }}
                  />
                  <h2 className="text-sm font-bold text-[#141414] uppercase tracking-wide">
                    AI NAVİGASYON AKTİF
                  </h2>
                </div>
                {activeRide.isPhantom && (
                  <div
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "#7C3AED" }}
                  >
                    <Ghost className="w-4 h-4" />
                    PHANTOM
                  </div>
                )}
              </div>

              <div className="mb-2">
                <Progress value={routeProgress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>%{routeProgress}</span>
                  <span style={{ color: "#276EF1" }}>
                    {routeProgress < 100 ? "Devam ediyor..." : "Varıldı"}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                {NAV_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className={`flex items-center gap-2 text-xs transition-all ${
                      i === navStep
                        ? "text-[#141414] font-semibold"
                        : i < navStep
                          ? "text-gray-300 line-through"
                          : "text-gray-400 opacity-50"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background:
                          i <= navStep ? "rgba(39,110,241,0.1)" : "transparent",
                        border: `1px solid ${i <= navStep ? "#276EF1" : "#E5E7EB"}`,
                      }}
                    >
                      {i < navStep ? (
                        <span style={{ color: "#276EF1", fontSize: "9px" }}>
                          ✓
                        </span>
                      ) : i === navStep ? (
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#276EF1]" />
                      ) : null}
                    </div>
                    {step}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  onClick={handleCompleteRide}
                  className="w-full rounded-xl font-bold tracking-wide uppercase text-xs text-white"
                  style={{ background: "#05944F" }}
                  data-ocid="driver.complete_ride.primary_button"
                >
                  YOLCULUĞU TAMAMLA
                </Button>
                {onLiveMap && (
                  <button
                    onClick={onLiveMap}
                    className="w-full py-3 font-bold text-xs tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
                    style={{
                      background: "rgba(39,110,241,0.08)",
                      border: "1px solid rgba(39,110,241,0.25)",
                      color: "#276EF1",
                    }}
                    type="button"
                    data-ocid="driver.track_ride.button"
                  >
                    🗺️ ROTA TAKİP
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowGhostChat(true)}
                  className="w-full py-3 font-bold text-xs tracking-wide uppercase rounded-xl transition-all hover:opacity-90"
                  style={{
                    background: "rgba(124,58,237,0.08)",
                    border: "1px solid rgba(124,58,237,0.25)",
                    color: "#7C3AED",
                  }}
                  data-ocid="driver.ghost_chat.button"
                >
                  💬 GHOST CHAT
                </button>
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
                  className="uber-card rounded-xl p-5"
                  style={{ borderColor: "rgba(124,58,237,0.2)" }}
                >
                  {pulseEvent.type === "trivia" ? (
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-wider mb-3"
                        style={{ color: "#7C3AED" }}
                      >
                        ⚡ PULSE TRİVİA
                      </p>
                      <p className="text-sm text-[#141414] mb-3">
                        {pulseEvent.question}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {pulseEvent.options.map((opt, i) => (
                          <button
                            type="button"
                            key={opt}
                            onClick={() => setSelectedAnswer(i)}
                            className="text-left text-xs px-3 py-2 rounded-xl transition-all"
                            style={{
                              background:
                                selectedAnswer === i
                                  ? i === pulseEvent.answer
                                    ? "rgba(5,148,79,0.1)"
                                    : "rgba(225,25,0,0.08)"
                                  : "#F9FAFB",
                              border: `1px solid ${
                                selectedAnswer === i
                                  ? i === pulseEvent.answer
                                    ? "#05944F"
                                    : "#E11900"
                                  : "#E5E7EB"
                              }`,
                              color:
                                selectedAnswer === i
                                  ? i === pulseEvent.answer
                                    ? "#05944F"
                                    : "#E11900"
                                  : "#6B7280",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {pulseEvent.message}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setPulseEvent(null)}
                    className="mt-3 text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    Kapat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {showGhostChat && activeRide && (
              <InRideGhostChat
                rideId={activeRide.rideId}
                mySessionId={session.sessionId}
                userRole="driver"
                onClose={() => setShowGhostChat(false)}
              />
            )}
          </>
        )}
      </div>

      <Dialog open={showRating} onOpenChange={setShowRating}>
        <DialogContent
          className="bg-white border-gray-200 text-[#141414]"
          data-ocid="driver.rating.dialog"
        >
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-sm">
              YOLCUYU DEĞERLENDİR
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
                    color: s <= ratingStars ? "#f5c84b" : "#D1D5DB",
                    fill: s <= ratingStars ? "#f5c84b" : "transparent",
                  }}
                />
              </button>
            ))}
          </div>
          <Button
            onClick={handleSubmitRating}
            className="w-full rounded-xl font-bold tracking-wide uppercase text-white"
            style={{ background: "#276EF1" }}
            data-ocid="driver.rating.submit_button"
          >
            DEĞERLENDİRMEYİ GÖNDER
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
