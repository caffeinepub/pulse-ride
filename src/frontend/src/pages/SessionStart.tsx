import { useActor } from "@/hooks/useActor";
import { ArrowLeft, Shield } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface SessionStartProps {
  role: "rider" | "driver";
  onSessionCreated: (sessionId: string, role: "rider" | "driver") => void;
  onBack: () => void;
}

const STEPS = [
  "Initializing secure channel...",
  "Generating cryptographic key pair...",
  "Creating anonymous session token...",
  "Encrypting identity hash...",
  "Session established ✓",
];

export default function SessionStart({
  role,
  onSessionCreated,
  onBack,
}: SessionStartProps) {
  const { actor } = useActor();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onSessionCreatedRef = useRef(onSessionCreated);
  onSessionCreatedRef.current = onSessionCreated;

  useEffect(() => {
    if (!actor) return;

    const interval = setInterval(() => {
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 600);

    actor
      .createSession(role)
      .then((sessionId) => {
        clearInterval(interval);
        setStep(STEPS.length - 1);
        setTimeout(() => onSessionCreatedRef.current(sessionId, role), 800);
      })
      .catch(() => {
        clearInterval(interval);
        setError("Failed to create session. Please try again.");
      });

    return () => clearInterval(interval);
  }, [actor, role]);

  const accent = role === "rider" ? "#a855ff" : "#2ee6d6";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="absolute inset-0 grid-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-8 w-full max-w-md relative"
        style={{ borderColor: `${accent}30` }}
        data-ocid="session.panel"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#a7b0c2] hover:text-white mb-6 transition-colors"
          data-ocid="session.back.button"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}35`,
            }}
          >
            <Shield className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div>
            <p
              className="text-xs uppercase tracking-widest font-semibold"
              style={{ color: accent }}
            >
              GENERATING SESSION
            </p>
            <h2 className="text-lg font-bold uppercase tracking-wider text-white">
              {role === "rider" ? "RIDER" : "DRIVER"} IDENTITY
            </h2>
          </div>
        </div>

        {error ? (
          <div
            className="text-center text-red-400 text-sm py-4"
            data-ocid="session.error_state"
          >
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <AnimatePresence key={s}>
                {i <= step && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background:
                          i === step && step < STEPS.length - 1
                            ? "transparent"
                            : `${accent}25`,
                        border: `1px solid ${accent}60`,
                      }}
                    >
                      {i < step || step === STEPS.length - 1 ? (
                        <span className="text-xs" style={{ color: accent }}>
                          ✓
                        </span>
                      ) : (
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ background: accent }}
                        />
                      )}
                    </div>
                    <span
                      className={i < step ? "text-[#a7b0c2]" : "text-white"}
                    >
                      {s}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-white/5">
          <div className="flex items-center justify-center gap-2 text-xs text-[#a7b0c2]">
            <Shield className="w-3 h-3" style={{ color: accent }} />
            No personal data collected or stored
          </div>
        </div>
      </motion.div>
    </div>
  );
}
