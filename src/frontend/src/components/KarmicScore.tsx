import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface KarmicScoreProps {
  sessionId: string;
  userRole: "rider" | "driver";
}

const ACTIONS = [
  { emoji: "✅", label: "Tam ödeme bildirimi", delta: 5, key: "full_payment" },
  { emoji: "⏰", label: "Sabırlı bekleme", delta: 3, key: "patient_wait" },
  { emoji: "💬", label: "Nazik mesaj gönder", delta: 2, key: "kind_message" },
];

export default function KarmicScore({ sessionId, userRole }: KarmicScoreProps) {
  const STORAGE_KEY = `karma_${sessionId}`;

  const [karma, setKarma] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number.parseInt(stored, 10) : 50;
  });
  const [showModal, setShowModal] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(karma));
  }, [karma, STORAGE_KEY]);

  function applyAction(delta: number) {
    setKarma((prev) => Math.min(100, prev + delta));
    setLastDelta(delta);
    setAnimKey((k) => k + 1);
    setTimeout(() => setLastDelta(null), 1500);
  }

  const barColor =
    karma >= 80 ? "#00ff88" : karma >= 50 ? "#ffd700" : "#ff4444";
  const isPriority = karma >= 80;

  return (
    <>
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{
          background: "rgba(0,245,255,0.04)",
          border: "1px solid rgba(0,245,255,0.15)",
        }}
        data-ocid="karma.panel"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: "#a7b0c2" }}
            >
              KARMA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {lastDelta !== null && (
                <motion.div
                  key={animKey}
                  className="text-xs font-black"
                  style={{ color: "#00ff88" }}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  transition={{ duration: 1.2 }}
                >
                  +{lastDelta}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.span
              key={`k-${karma}`}
              className="text-lg font-black"
              style={{ color: barColor, textShadow: `0 0 15px ${barColor}80` }}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {karma}
            </motion.span>
          </div>
        </div>

        {/* Bar */}
        <div
          className="relative w-full h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: barColor, boxShadow: `0 0 8px ${barColor}` }}
            animate={{ width: `${karma}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Priority badge */}
        <AnimatePresence>
          {isPriority && (
            <motion.div
              className="flex items-center justify-center gap-2 py-1 px-3 rounded-full text-xs font-bold tracking-widest"
              style={{
                background: "rgba(0,255,136,0.1)",
                border: "1px solid rgba(0,255,136,0.4)",
                color: "#00ff88",
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                boxShadow: [
                  "0 0 10px rgba(0,255,136,0.3)",
                  "0 0 25px rgba(0,255,136,0.6)",
                  "0 0 10px rgba(0,255,136,0.3)",
                ],
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                boxShadow: { repeat: Number.POSITIVE_INFINITY, duration: 1.5 },
              }}
              data-ocid="karma.priority_badge"
            >
              🌟 {userRole === "rider" ? "ÖNCELİKLİ YOLCU" : "ÖNCELİKLİ SÜRÜCÜ"}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Boost button — rider only */}
        {userRole === "rider" && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
            style={{
              background: "rgba(0,245,255,0.06)",
              border: "1px solid rgba(0,245,255,0.25)",
              color: "#00f5ff",
            }}
            data-ocid="karma.boost_button"
          >
            ⚡ KARMAMI ARTIR
          </button>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
            data-ocid="karma.boost_modal"
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3"
              style={{
                background: "linear-gradient(135deg, #0d1020, #0a0f1e)",
                border: "1px solid rgba(0,245,255,0.25)",
                boxShadow: "0 0 40px rgba(0,245,255,0.1)",
              }}
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-2">
                <div
                  className="text-sm font-black tracking-widest"
                  style={{ color: "#00f5ff" }}
                >
                  ⚡ KARMA ARTIR
                </div>
                <div className="text-xs mt-1" style={{ color: "#a7b0c2" }}>
                  İyi davranış, öncelik kazan
                </div>
              </div>
              {ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    applyAction(action.delta);
                    setShowModal(false);
                  }}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: "rgba(0,245,255,0.06)",
                    border: "1px solid rgba(0,245,255,0.15)",
                    color: "#c8d0e0",
                  }}
                  data-ocid={`karma.action_${action.key}.button`}
                >
                  <span>
                    {action.emoji} {action.label}
                  </span>
                  <span
                    className="text-xs font-black"
                    style={{ color: "#00ff88" }}
                  >
                    +{action.delta}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="mt-1 text-xs text-center w-full py-2"
                style={{ color: "#a7b0c2" }}
                data-ocid="karma.boost_modal_close_button"
              >
                Kapat
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
