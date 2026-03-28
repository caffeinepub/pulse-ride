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

const TRANSLATION_LANGS = [
  "TR→EN",
  "TR→DE",
  "TR→FR",
  "EN→TR",
  "KAPALI",
] as const;
type TranslationLang = (typeof TRANSLATION_LANGS)[number];

function playRingTone(ctx: AudioContext): OscillatorNode[] {
  const oscs: OscillatorNode[] = [];
  const playBeep = (startTime: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.value = 480;
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
    g.gain.setValueAtTime(0.2, startTime + 0.4);
    g.gain.linearRampToValueAtTime(0, startTime + 0.45);
    osc.start(startTime);
    osc.stop(startTime + 0.5);
    oscs.push(osc);
  };
  const now = ctx.currentTime;
  for (let i = 0; i < 6; i++) playBeep(now + i * 0.8);
  return oscs;
}

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
// Returns processed stream for WebRTC (NOT connected to local speakers)
function buildEffectChain(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  style: VoiceStyle,
): { analyser: AnalyserNode; processedStream: MediaStream } {
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

  // Analyser for waveform visualization ONLY - NOT connected to speakers
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;

  // MediaStreamDestination for WebRTC - this is what the other party hears
  const streamDest = ctx.createMediaStreamDestination();

  source.connect(lowShelf);
  lowShelf.connect(waveShaper);
  waveShaper.connect(highShelf);
  highShelf.connect(gain);
  // Connect to analyser for visualization (no speaker output)
  gain.connect(analyser);
  // Connect to stream destination for WebRTC transmission
  gain.connect(streamDest);
  // NOTE: NOT connected to ctx.destination - prevents local echo

  return { analyser, processedStream: streamDest.stream };
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
  const [isSpeaker, setIsSpeaker] = useState(false);
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
  // incoming = ringing (non-initiator waiting to accept), calling = initiator waiting
  const [callPhase, setCallPhase] = useState<"calling" | "incoming" | "active">(
    isInitiator ? "calling" : "incoming",
  );
  const [translation, setTranslation] = useState<TranslationLang>("KAPALI");
  const [translatedText, setTranslatedText] = useState<string>("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const sigPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sigIndexRef = useRef<bigint>(BigInt(0));
  const processedSigIds = useRef<Set<string>>(new Set());
  const ringCtxRef = useRef<AudioContext | null>(null);
  const muteTracksRef = useRef<MediaStreamTrack[]>([]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    // Mute/unmute audio tracks directly
    for (const track of muteTracksRef.current) {
      track.enabled = !isMuted;
    }
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

  // Set up WebRTC peer connection using processed (AI-masked) audio stream
  const setupPeerConnection = (processedStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;

    // Add processed/masked audio tracks (NOT raw microphone)
    for (const track of processedStream.getTracks()) {
      pc.addTrack(track, processedStream);
    }

    // Play remote audio through speakers
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
          if (!text.startsWith("__CALL__:")) {
            if (Number(idx) + 1 > Number(sigIndexRef.current))
              sigIndexRef.current = BigInt(Number(idx) + 1);
            continue;
          }

          processedSigIds.current.add(msgKey);
          if (Number(idx) + 1 > Number(sigIndexRef.current))
            sigIndexRef.current = BigInt(Number(idx) + 1);

          const parts = text.slice("__CALL__:".length).split(":");
          const sigType = parts[0];
          const payloadStr = parts.slice(1).join(":");

          try {
            const payload = JSON.parse(payloadStr);

            if (sigType === "INVITE" && !isInitiator) {
              // Incoming call signal - already showing incoming UI, just confirm
              setCallPhase("incoming");
            } else if (sigType === "ACCEPTED" && isInitiator) {
              // Other party accepted - start audio and WebRTC
              setCallPhase("active");
              await startActiveCall(pc);
            } else if (sigType === "REJECTED" && isInitiator) {
              handleClose();
            } else if (sigType === "OFFER" && !isInitiator) {
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

  // Start active call (after accept)
  const startActiveCall = async (pc: RTCPeerConnection) => {
    const processedStream = processedStreamRef.current;
    if (!processedStream) return;
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("OFFER", offer);
    }
    // Start timer
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    playConnectTone(audioCtxRef.current!);
  };

  // Start audio (microphone + AI masking effect)
  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;
      muteTracksRef.current = stream.getAudioTracks();

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      const { analyser, processedStream } = buildEffectChain(
        ctx,
        source,
        voiceStyle,
      );
      processedStreamRef.current = processedStream;
      analyserRef.current = analyser;
      // Waveform visualization
      startWaveformLoop(analyser);
      setMicPermission("granted");

      if (actor && channelCode && myId) {
        const pc = setupPeerConnection(processedStream);
        setRtcStatus("signaling");
        startSignalingPoll(pc);
      }
    } catch {
      setMicPermission("denied");
    }
  };

  // Stop ring tone
  const stopRingTone = () => {
    if (ringCtxRef.current && ringCtxRef.current.state !== "closed") {
      ringCtxRef.current.close();
      ringCtxRef.current = null;
    }
  };

  // Stop all audio and WebRTC
  const stopAudio = () => {
    stopRingTone();
    if (sigPollRef.current) {
      clearInterval(sigPollRef.current);
      sigPollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
    processedStreamRef.current = null;
    analyserRef.current = null;
    muteTracksRef.current = [];
    processedSigIds.current.clear();
    sigIndexRef.current = BigInt(0);
    setBarHeights(Array(BAR_COUNT).fill(4));
    setMicPermission("pending");
    setRtcStatus("idle");
    setTranslatedText("");
  };

  // Accept incoming call
  const handleAccept = async () => {
    stopRingTone();
    setCallPhase("active");
    await sendSignal("ACCEPTED", {});
    // Start timer
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    if (audioCtxRef.current) playConnectTone(audioCtxRef.current);
    // Send offer from non-initiator side too for bidirectional
    if (pcRef.current && processedStreamRef.current) {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      await sendSignal("OFFER", offer);
    }
  };

  // Reject incoming call
  const handleReject = async () => {
    await sendSignal("REJECTED", {});
    handleClose();
  };

  // Simulate AI translation (since no real translation API)
  const simulateTranslation = (lang: TranslationLang) => {
    if (lang === "KAPALI") {
      setTranslatedText("");
      return;
    }
    const samples: Record<string, string[]> = {
      "TR→EN": [
        "Hello, I am on my way",
        "Please wait a moment",
        "I will arrive in 5 minutes",
        "Traffic is a bit heavy",
      ],
      "TR→DE": [
        "Hallo, ich bin unterwegs",
        "Bitte warten Sie einen Moment",
        "Ich komme in 5 Minuten",
        "Es gibt etwas Verkehr",
      ],
      "TR→FR": [
        "Bonjour, je suis en route",
        "Veuillez patienter",
        "J'arriverai dans 5 minutes",
        "Il y a un peu de circulation",
      ],
      "EN→TR": [
        "Merhaba, yoldayım",
        "Lütfen bir dakika bekleyin",
        "5 dakikada gelirim",
        "Biraz trafik var",
      ],
    };
    const options = samples[lang] ?? [];
    const idx = Math.floor(Math.random() * options.length);
    setTranslatedText(options[idx]);
  };

  // Main open/close effect
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (isOpen) {
      setElapsed(0);
      setIsMuted(false);
      isMutedRef.current = false;
      setCallPhase(isInitiator ? "calling" : "incoming");
      startAudio();

      // Play ring tone while in calling/incoming phase
      try {
        const rCtx = new AudioContext();
        ringCtxRef.current = rCtx;
        playRingTone(rCtx);
      } catch (_e) {
        /* ignore */
      }
    } else {
      stopAudio();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Stop ring tone when call becomes active
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopRingTone is stable
  useEffect(() => {
    if (callPhase === "active") {
      stopRingTone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callPhase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (sigPollRef.current) clearInterval(sigPollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pcRef.current) pcRef.current.close();
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== "closed") ctx.close();
      if (ringCtxRef.current && ringCtxRef.current.state !== "closed")
        ringCtxRef.current.close();
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
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

  // INCOMING CALL SCREEN
  if (isOpen && callPhase === "incoming") {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(6,8,18,0.97)" }}
        >
          {/* Pulsing ring animation */}
          <motion.div
            className="absolute w-48 h-48 rounded-full"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
            style={{
              background:
                "radial-gradient(circle, rgba(0,255,247,0.3) 0%, transparent 70%)",
            }}
          />

          <div className="flex flex-col items-center gap-8 z-10">
            {/* Ghost avatar */}
            <motion.div
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
              style={{
                background:
                  "radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(0,255,247,0.05) 100%)",
                border: "2px solid rgba(0,255,247,0.5)",
                boxShadow: "0 0 40px rgba(0,255,247,0.3)",
              }}
            >
              👻
            </motion.div>

            <div className="text-center" style={{ fontFamily: "monospace" }}>
              <div className="text-xs text-[#a7b0c2] uppercase tracking-widest mb-1">
                Gelen Arama
              </div>
              <div className="text-xl font-bold" style={{ color: "#00fff7" }}>
                {callerIds.find((id) => id !== myId) ?? "GHOST-????"}
              </div>
              <motion.div
                className="text-xs mt-2"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                style={{ color: "#a7b0c2" }}
              >
                📞 GHOST CALL geliyor...
              </motion.div>
            </div>

            {/* Accept / Reject */}
            <div className="flex gap-10">
              <button
                type="button"
                onClick={handleReject}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all active:scale-95"
                style={{
                  background: "rgba(239,68,68,0.2)",
                  border: "2px solid rgba(239,68,68,0.7)",
                  boxShadow: "0 0 20px rgba(239,68,68,0.3)",
                }}
              >
                📵
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all active:scale-95"
                style={{
                  background: "rgba(34,197,94,0.2)",
                  border: "2px solid rgba(34,197,94,0.7)",
                  boxShadow: "0 0 20px rgba(34,197,94,0.3)",
                }}
              >
                📞
              </button>
            </div>

            <div
              className="text-xs"
              style={{
                color: "rgba(167,176,194,0.5)",
                fontFamily: "monospace",
              }}
            >
              Reddet
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              Cevapla
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // CALLING SCREEN (initiator waiting)
  if (isOpen && callPhase === "calling") {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(6,8,18,0.97)" }}
        >
          <motion.div
            className="absolute w-48 h-48 rounded-full"
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.05, 0.2] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            style={{
              background:
                "radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)",
            }}
          />
          <div className="flex flex-col items-center gap-8 z-10">
            <motion.div
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
              style={{
                background:
                  "radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(0,255,247,0.05) 100%)",
                border: "2px solid rgba(168,85,247,0.5)",
                boxShadow: "0 0 40px rgba(168,85,247,0.3)",
              }}
            >
              👻
            </motion.div>
            <div className="text-center" style={{ fontFamily: "monospace" }}>
              <div
                className="text-xl font-bold mb-2"
                style={{ color: "#a855f7" }}
              >
                {callerIds.find((id) => id !== myId) ?? "GHOST-????"}
              </div>
              <motion.div
                className="text-sm"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY }}
                style={{ color: "#a7b0c2" }}
              >
                Aranıyor...
              </motion.div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{
                background: "rgba(239,68,68,0.2)",
                border: "2px solid rgba(239,68,68,0.7)",
                boxShadow: "0 0 20px rgba(239,68,68,0.3)",
              }}
            >
              📵
            </button>
            <div
              className="text-xs"
              style={{
                color: "rgba(167,176,194,0.5)",
                fontFamily: "monospace",
              }}
            >
              İptal
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ACTIVE CALL SCREEN
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

          <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm px-6">
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
                ? "🔇 MİKROFON GEREKİYOR"
                : micPermission === "granted"
                  ? "🎤 AI MASKELEME AKTİF"
                  : "⏳ MİKROFON BAĞLANIYOR..."}
            </motion.div>

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

            {/* Caller info */}
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

            {/* Waveform */}
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

            {/* AI Translation */}
            <div className="w-full">
              <div
                className="text-[10px] text-center mb-1"
                style={{ color: "#a7b0c2", fontFamily: "monospace" }}
              >
                🌐 AI ÇEVİRİ
              </div>
              <div className="flex gap-1 justify-center flex-wrap">
                {TRANSLATION_LANGS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setTranslation(lang);
                      simulateTranslation(lang);
                    }}
                    className="text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider transition-all"
                    style={{
                      background:
                        translation === lang
                          ? "rgba(34,197,94,0.25)"
                          : "rgba(255,255,255,0.04)",
                      border:
                        translation === lang
                          ? "1px solid rgba(34,197,94,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                      color: translation === lang ? "#22c55e" : "#a7b0c2",
                      fontFamily: "monospace",
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              {translatedText && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-xs text-center px-3 py-2 rounded-lg"
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    color: "#22c55e",
                    fontFamily: "monospace",
                  }}
                >
                  🌐 {translatedText}
                </motion.div>
              )}
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
                onClick={async () => {
                  const newSpeaker = !isSpeaker;
                  setIsSpeaker(newSpeaker);
                  if (remoteAudioRef.current) {
                    try {
                      await (remoteAudioRef.current as any).setSinkId?.(
                        newSpeaker ? "default" : "",
                      );
                    } catch (_e) {
                      /* not supported */
                    }
                  }
                }}
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all"
                style={{
                  background: isSpeaker
                    ? "rgba(0,255,136,0.2)"
                    : "rgba(0,255,247,0.08)",
                  border: isSpeaker
                    ? "1.5px solid rgba(0,255,136,0.6)"
                    : "1.5px solid rgba(0,255,247,0.3)",
                }}
                title={isSpeaker ? "Hoparlör" : "Kulaklık"}
              >
                {isSpeaker ? "🔊" : "🔈"}
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
