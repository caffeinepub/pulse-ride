import type { backendInterface } from "@/backend.d";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export interface GhostCallOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  callerIds: string[];
  isGroup?: boolean;
  actor?: backendInterface | null;
  channelCode?: string;
  myId?: string;
  isInitiator?: boolean;
}

const VOICE_STYLES = ["MALE", "FEMALE", "NEUTRAL", "SYNTHETIC"] as const;
type VoiceStyle = (typeof VOICE_STYLES)[number];

const BAR_COUNT = 16;
const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function playConnectTone(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.15, now + 0.05);
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(440, now + 0.1);
  g.gain.setValueAtTime(0.15, now + 0.15);
  g.gain.linearRampToValueAtTime(0, now + 0.2);
  osc.start(now);
  osc.stop(now + 0.25);
}

function playDisconnectTone(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.15, now);
  g.gain.linearRampToValueAtTime(0, now + 0.3);
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.linearRampToValueAtTime(220, now + 0.3);
  osc.start(now);
  osc.stop(now + 0.35);
}

// Apply AI voice masking effect chain
function buildEffectChain(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  style: VoiceStyle,
): { analyser: AnalyserNode; destination: AudioNode } {
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 300;
  lowShelf.gain.value = style === "MALE" ? 6 : style === "FEMALE" ? -8 : -10;

  const waveShaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = ((Math.PI + 80) * x) / (Math.PI + 80 * Math.abs(x));
  }
  waveShaper.curve = curve;
  waveShaper.oversample = "4x";

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 3000;
  highShelf.gain.value = style === "FEMALE" ? 4 : -8;

  const gain = ctx.createGain();
  gain.gain.value = 0.7;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;

  source.connect(lowShelf);
  lowShelf.connect(waveShaper);
  waveShaper.connect(highShelf);
  highShelf.connect(gain);
  gain.connect(analyser);

  return { analyser, destination: gain };
}

export default function GhostCallOverlay({
  isOpen,
  onClose,
  callerIds,
  isGroup = false,
  actor,
  channelCode,
  myId,
  isInitiator = false,
}: GhostCallOverlayProps) {
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("SYNTHETIC");
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micPermission, setMicPermission] = useState<
    "pending" | "granted" | "denied"
  >("pending");
  const [barHeights, setBarHeights] = useState<number[]>(
    Array(BAR_COUNT).fill(4),
  );
  const [rtcStatus, setRtcStatus] = useState<
    "idle" | "signaling" | "connected" | "failed"
  >("idle");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainDestRef = useRef<AudioNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const sigPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sigIndexRef = useRef<bigint>(BigInt(0));
  const processedSigIds = useRef<Set<string>>(new Set());

  // Keep muted ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Waveform animation loop
  const startWaveformLoop = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      if (isMutedRef.current) {
        setBarHeights(Array(BAR_COUNT).fill(4));
        return;
      }
      analyser.getByteTimeDomainData(data);
      const heights: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = data[i * step] ?? 128;
        const normalized = Math.abs(val - 128) / 128;
        heights.push(Math.max(4, normalized * 44));
      }
      setBarHeights(heights);
    }
    loop();
  };

  // Send signaling message via backend
  const sendSignal = async (type: string, payload: unknown) => {
    if (!actor || !channelCode || !myId) return;
    const msg = `__CALL__:${type}:${JSON.stringify(payload)}`;
    try {
      if (isGroup) {
        await actor.sendGroupMessage(channelCode, myId, msg);
      } else {
        await actor.sendGhostMessage(channelCode, myId, msg);
      }
    } catch (_e) {
      /* ignore */
    }
  };

  // Set up WebRTC peer connection
  const setupPeerConnection = (localStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;

    // Add local tracks
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    // Play remote audio
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteAudioRef.current) {
        const audio = new Audio();
        audio.autoplay = true;
        remoteAudioRef.current = audio;
      }
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {
        /* ignore */
      });
      setRtcStatus("connected");
    };

    // Send ICE candidates via backend signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ICE", event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setRtcStatus("connected");
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setRtcStatus("failed");
      }
    };

    return pc;
  };

  // Start signaling polling
  const startSignalingPoll = (pc: RTCPeerConnection) => {
    if (!actor || !channelCode || !myId) return;

    sigPollRef.current = setInterval(async () => {
      try {
        let msgs: Array<[string, string, bigint]>;
        if (isGroup) {
          msgs = await actor.getGroupMessages(
            channelCode,
            myId,
            sigIndexRef.current,
          );
        } else {
          msgs = await actor.getGhostMessages(
            channelCode,
            myId,
            sigIndexRef.current,
          );
        }

        for (const [senderId, text, idx] of msgs) {
          const msgKey = `${senderId}-${idx}`;
          if (senderId === myId) {
            if (Number(idx) + 1 > Number(sigIndexRef.current))
              sigIndexRef.current = BigInt(Number(idx) + 1);
            continue;
          }
          if (processedSigIds.current.has(msgKey)) continue;
          if (!text.startsWith("__CALL__:")) continue;

          processedSigIds.current.add(msgKey);
          if (Number(idx) + 1 > Number(sigIndexRef.current))
            sigIndexRef.current = BigInt(Number(idx) + 1);

          const parts = text.slice("__CALL__:".length).split(":");
          const sigType = parts[0];
          const payloadStr = parts.slice(1).join(":");

          try {
            const payload = JSON.parse(payloadStr);

            if (sigType === "OFFER" && !isInitiator) {
              await pc.setRemoteDescription(new RTCSessionDescription(payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal("ANSWER", answer);
              setRtcStatus("signaling");
            } else if (sigType === "ANSWER" && isInitiator) {
              if (pc.signalingState !== "stable") {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(payload),
                );
              }
            } else if (sigType === "ICE") {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(payload));
              }
            }
          } catch (_e) {
            /* ignore parse/webrtc errors */
          }
        }
      } catch (_e) {
        /* ignore poll errors */
      }
    }, 800);
  };

  // Start audio (microphone + AI masking effect) + WebRTC
  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const { analyser, destination } = buildEffectChain(
        ctx,
        source,
        voiceStyle,
      );
      gainDestRef.current = destination;
      analyserRef.current = analyser;
      analyser.connect(ctx.destination);

      startWaveformLoop(analyser);
      setMicPermission("granted");
      playConnectTone(ctx);

      // Set up WebRTC if actor and channelCode provided
      if (actor && channelCode && myId) {
        const pc = setupPeerConnection(stream);
        setRtcStatus("signaling");
        startSignalingPoll(pc);

        if (isInitiator) {
          // Create and send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal("OFFER", offer);
        }
      }
    } catch {
      setMicPermission("denied");
    }
  };

  // Stop audio and WebRTC cleanup
  const stopAudio = () => {
    if (sigPollRef.current) {
      clearInterval(sigPollRef.current);
      sigPollRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "closed") {
      playDisconnectTone(ctx);
      setTimeout(() => {
        ctx.close();
        audioCtxRef.current = null;
      }, 400);
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    sourceRef.current = null;
    gainDestRef.current = null;
    analyserRef.current = null;
    processedSigIds.current.clear();
    sigIndexRef.current = BigInt(0);
    setBarHeights(Array(BAR_COUNT).fill(4));
    setMicPermission("pending");
    setRtcStatus("idle");
  };

  // Handle mute — disconnect/reconnect microphone source
  useEffect(() => {
    const source = sourceRef.current;
    const dest = gainDestRef.current;
    if (!source || !dest) return;
    if (isMuted) {
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
    } else {
      try {
        source.connect(dest);
      } catch {
        /* ignore */
      }
    }
  }, [isMuted]);

  // Main open/close effect
  // biome-ignore lint/correctness/useExhaustiveDependencies: startAudio/stopAudio intentionally omitted
  useEffect(() => {
    if (isOpen) {
      setElapsed(0);
      setIsMuted(false);
      isMutedRef.current = false;
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      startAudio();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudio();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (sigPollRef.current) clearInterval(sigPollRef.current);
      if (pcRef.current) pcRef.current.close();
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== "closed") ctx.close();
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
    // run only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  const handleClose = () => {
    stopAudio();
    onClose();
  };

  const rtcStatusLabel = () => {
    if (!actor || !channelCode) return null;
    if (rtcStatus === "signaling")
      return (
        <span
          style={{
            color: "#f59e0b",
            fontSize: "10px",
            fontFamily: "monospace",
          }}
        >
          ⟳ BAĞLANIYOR...
        </span>
      );
    if (rtcStatus === "connected")
      return (
        <span
          style={{
            color: "#22c55e",
            fontSize: "10px",
            fontFamily: "monospace",
          }}
        >
          ● CANLI SES AKTİF
        </span>
      );
    if (rtcStatus === "failed")
      return (
        <span
          style={{
            color: "#ef4444",
            fontSize: "10px",
            fontFamily: "monospace",
          }}
        >
          ✕ BAĞLANTI KESİLDİ
        </span>
      );
    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(6,8,18,0.97)" }}
          data-ocid="ghost_call.modal"
        >
          {/* Glowing border frame */}
          <div
            className="absolute inset-4 rounded-2xl pointer-events-none"
            style={{
              border: "1px solid rgba(0,255,247,0.25)",
              boxShadow:
                "0 0 60px rgba(0,255,247,0.1), inset 0 0 60px rgba(0,255,247,0.03)",
            }}
          />

          {/* Scan line animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
            <motion.div
              className="absolute left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(0,255,247,0.4), transparent)",
              }}
              animate={{ top: ["0%", "100%"] }}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-6">
            {/* Status badge */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-[10px] font-bold tracking-widest px-4 py-1.5 rounded-full uppercase"
              style={{
                background:
                  micPermission === "denied"
                    ? "rgba(255,50,80,0.1)"
                    : "rgba(0,255,247,0.1)",
                border:
                  micPermission === "denied"
                    ? "1px solid rgba(255,50,80,0.4)"
                    : "1px solid rgba(0,255,247,0.35)",
                color: micPermission === "denied" ? "#ff3250" : "#00fff7",
                fontFamily: "monospace",
              }}
              data-ocid="ghost_call.loading_state"
            >
              {micPermission === "denied"
                ? "🔇 SESİ AÇMAK İÇİN MİKROFON GEREKİYOR"
                : micPermission === "granted"
                  ? "🎤 MİKROFON AKTİF • AI MASKELEME AÇIK"
                  : "⏳ MİKROFON BAĞLANIYOR..."}
            </motion.div>

            {/* Mic denied warning */}
            {micPermission === "denied" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center text-xs px-4 py-2 rounded-lg"
                style={{
                  background: "rgba(255,50,80,0.08)",
                  border: "1px solid rgba(255,50,80,0.3)",
                  color: "#ff3250",
                  fontFamily: "monospace",
                }}
                data-ocid="ghost_call.error_state"
              >
                MİKROFON ERİŞİMİ GEREKİYOR
                <br />
                <span style={{ color: "#a7b0c2", fontSize: "10px" }}>
                  Tarayıcı izinlerinden mikrofonu etkinleştirin
                </span>
              </motion.div>
            )}

            {/* Call type */}
            <div className="text-center" style={{ fontFamily: "monospace" }}>
              {isGroup ? (
                <div
                  className="text-sm font-bold tracking-widest uppercase"
                  style={{ color: "#a855f7" }}
                >
                  GRUP ARAMASI • {callerIds.length} KATILIMCI
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-xs text-[#a7b0c2] uppercase tracking-widest">
                    Bağlı:
                  </div>
                  <div
                    className="text-base font-bold"
                    style={{ color: "#00fff7" }}
                  >
                    {callerIds.find((id) => id !== myId) ?? "GHOST-????"}
                  </div>
                </div>
              )}
            </div>

            {/* RTC Status */}
            {rtcStatusLabel() && (
              <div className="flex items-center gap-2">{rtcStatusLabel()}</div>
            )}

            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(0,255,247,0.05) 100%)",
                border: "1.5px solid rgba(168,85,247,0.5)",
                boxShadow:
                  rtcStatus === "connected"
                    ? "0 0 30px rgba(34,197,94,0.4), 0 0 60px rgba(34,197,94,0.15)"
                    : "0 0 30px rgba(168,85,247,0.3)",
              }}
            >
              👻
            </div>

            {/* Real-time waveform */}
            <div className="flex items-end justify-center gap-0.5 h-12 w-48">
              {barHeights.map((h, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static bar count
                  key={i}
                  className="flex-1 rounded-full"
                  style={{
                    height: `${h}px`,
                    minHeight: "4px",
                    background:
                      isMuted || micPermission !== "granted"
                        ? "rgba(0,255,247,0.2)"
                        : `rgba(0,255,247,${0.4 + (h / 44) * 0.6})`,
                    transition: "height 0.05s ease",
                  }}
                />
              ))}
            </div>

            {/* Timer */}
            <div
              className="text-2xl font-bold tracking-widest"
              style={{ color: "#00fff7", fontFamily: "monospace" }}
            >
              {formatTime(elapsed)}
            </div>

            {/* Voice style selector */}
            <div className="flex gap-2 flex-wrap justify-center">
              {VOICE_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setVoiceStyle(style)}
                  className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest transition-all"
                  style={{
                    background:
                      voiceStyle === style
                        ? "rgba(168,85,247,0.3)"
                        : "rgba(255,255,255,0.04)",
                    border:
                      voiceStyle === style
                        ? "1px solid rgba(168,85,247,0.7)"
                        : "1px solid rgba(255,255,255,0.1)",
                    color: voiceStyle === style ? "#a855f7" : "#a7b0c2",
                    fontFamily: "monospace",
                  }}
                >
                  {style}
                </button>
              ))}
            </div>

            {/* Info */}
            <div
              className="text-center text-[10px] leading-relaxed"
              style={{
                color: "rgba(167,176,194,0.6)",
                fontFamily: "monospace",
              }}
            >
              SES AI TARAFINDAN MASKELENİYOR
              <br />
              ORİJİNAL SES HİÇBİR YERDE SAKLANMIYOR
            </div>

            {/* Controls */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all"
                style={{
                  background: isMuted
                    ? "rgba(255,50,80,0.2)"
                    : "rgba(0,255,247,0.08)",
                  border: isMuted
                    ? "1.5px solid rgba(255,50,80,0.6)"
                    : "1.5px solid rgba(0,255,247,0.3)",
                }}
              >
                {isMuted ? "🔇" : "🎤"}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all"
                style={{
                  background: "rgba(255,50,80,0.2)",
                  border: "1.5px solid rgba(255,50,80,0.6)",
                }}
              >
                📵
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
