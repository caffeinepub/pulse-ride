import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface GhostAlarmSetupProps {
  onBack: () => void;
}

export default function GhostAlarmSetupPage({ onBack }: GhostAlarmSetupProps) {
  const [triggerWord, setTriggerWord] = useState(
    () => localStorage.getItem("ghost_alarm_word") || "",
  );
  const [contacts, setContacts] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ghost_alarm_contacts") || "[]");
    } catch {
      return [];
    }
  });
  const [contactInput, setContactInput] = useState("");
  const [alarmActive, setAlarmActive] = useState(
    () => !!localStorage.getItem("ghost_alarm_word"),
  );
  const [triggerFlash, setTriggerFlash] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (triggerWord.length < 3) return;
    localStorage.setItem("ghost_alarm_word", triggerWord);
    localStorage.setItem("ghost_alarm_contacts", JSON.stringify(contacts));
    setAlarmActive(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDeactivate() {
    localStorage.removeItem("ghost_alarm_word");
    localStorage.removeItem("ghost_alarm_contacts");
    setAlarmActive(false);
    setTriggerWord("");
    setContacts([]);
  }

  function handleAddContact() {
    const clean = contactInput.trim().toUpperCase();
    if (!clean || contacts.length >= 3 || contacts.includes(clean)) return;
    const updated = [...contacts, clean];
    setContacts(updated);
    setContactInput("");
  }

  function handleRemoveContact(c: string) {
    setContacts(contacts.filter((x) => x !== c));
  }

  function handleDemoTrigger() {
    setTriggerFlash(true);
    setTimeout(() => setTriggerFlash(false), 2000);
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #080308 0%, #120205 50%, #080308 100%)",
      }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(180,0,0,0.025) 2px, rgba(180,0,0,0.025) 4px)",
        }}
      />

      {/* DEMO TRIGGER FLASH */}
      <AnimatePresence>
        {triggerFlash && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: "#000000" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-ocid="alarm.trigger_flash"
          >
            <motion.div
              className="text-3xl font-black tracking-widest text-center"
              style={{
                color: "#ff2222",
                textShadow: "0 0 30px rgba(255,34,34,0.8)",
              }}
              animate={{ opacity: [1, 0.3, 1, 0.3, 1] }}
              transition={{ duration: 1.5 }}
            >
              📡 KONUM İLETİLİYOR...
            </motion.div>
            <div
              className="mt-4 text-sm font-mono"
              style={{ color: "rgba(255,0,0,0.6)" }}
            >
              ANONIM SİNYAL AKTİF
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-8 z-10">
        {/* Header */}
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-8 text-xs px-4 py-2 rounded-full font-bold tracking-widest uppercase"
          style={{ border: "1px solid rgba(180,0,0,0.4)", color: "#ff4444" }}
          data-ocid="alarm.back_button"
        >
          ← GERİ
        </button>

        <div className="text-center mb-8">
          <motion.div
            className="text-6xl mb-3"
            animate={{
              filter: [
                "drop-shadow(0 0 10px rgba(255,0,0,0.5))",
                "drop-shadow(0 0 30px rgba(255,0,0,0.9))",
                "drop-shadow(0 0 10px rgba(255,0,0,0.5))",
              ],
            }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
          >
            🚨
          </motion.div>
          <h1
            className="text-3xl font-black tracking-widest uppercase"
            style={{
              color: "#ff2222",
              textShadow: "0 0 25px rgba(255,34,34,0.7)",
            }}
          >
            GHOST ALARM
          </h1>
          <p className="text-xs mt-2" style={{ color: "#7a5555" }}>
            Sesli tetik — görsel hiçbir iz yok
          </p>
        </div>

        {/* Status */}
        <div
          className="flex items-center justify-between rounded-xl px-5 py-4 mb-6"
          style={{
            background: alarmActive
              ? "rgba(255,34,34,0.08)"
              : "rgba(80,80,80,0.06)",
            border: alarmActive
              ? "1px solid rgba(255,34,34,0.4)"
              : "1px solid rgba(80,80,80,0.2)",
          }}
          data-ocid="alarm.status_panel"
        >
          <div>
            <div
              className="text-xs tracking-widest font-bold"
              style={{ color: "#7a5555" }}
            >
              DURUM
            </div>
            <div
              className="text-lg font-black tracking-wider"
              style={{ color: alarmActive ? "#ff2222" : "#555" }}
            >
              {alarmActive ? "🔴 ALARM AKTİF" : "⚫ ALARM PASİF"}
            </div>
          </div>
          {alarmActive && (
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{ background: "#ff2222" }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8 }}
            />
          )}
        </div>

        {/* Trigger word */}
        <div className="mb-5">
          <div
            className="text-xs font-bold tracking-widest uppercase block mb-2"
            style={{ color: "#7a5555" }}
          >
            GİZLİ TETİK SÖZCÜK
          </div>
          <input
            type="text"
            value={triggerWord}
            onChange={(e) => setTriggerWord(e.target.value)}
            placeholder="Örn: fırtına (min 3 karakter)"
            maxLength={20}
            className="w-full rounded-xl px-4 py-3 font-mono text-sm outline-none"
            style={{
              background: "rgba(120,0,0,0.15)",
              border: "1px solid rgba(180,0,0,0.35)",
              color: "#ffaaaa",
            }}
            data-ocid="alarm.trigger_word_input"
          />
          {triggerWord.length > 0 && triggerWord.length < 3 && (
            <div
              className="text-xs mt-1"
              style={{ color: "#ff4444" }}
              data-ocid="alarm.trigger_word_error"
            >
              En az 3 karakter gerekli
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="mb-6">
          <div
            className="text-xs font-bold tracking-widest uppercase block mb-2"
            style={{ color: "#7a5555" }}
          >
            ACİL KİŞİLER (maks 3) — GHOST KODU
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
              placeholder="GHOST-XXXX"
              className="flex-1 rounded-xl px-4 py-3 font-mono text-sm outline-none"
              style={{
                background: "rgba(120,0,0,0.1)",
                border: "1px solid rgba(180,0,0,0.25)",
                color: "#ffaaaa",
              }}
              data-ocid="alarm.contact_input"
            />
            <button
              type="button"
              onClick={handleAddContact}
              disabled={contacts.length >= 3}
              className="px-4 py-3 rounded-xl font-bold text-xs tracking-widest uppercase disabled:opacity-40"
              style={{
                background: "rgba(180,0,0,0.2)",
                border: "1px solid rgba(255,34,34,0.4)",
                color: "#ff4444",
              }}
              data-ocid="alarm.add_contact_button"
            >
              EKLE
            </button>
          </div>
          {contacts.map((c, i) => (
            <div
              key={c}
              className="flex items-center justify-between px-3 py-2 rounded-lg mb-1"
              style={{
                background: "rgba(180,0,0,0.08)",
                border: "1px solid rgba(180,0,0,0.15)",
              }}
            >
              <span className="font-mono text-sm" style={{ color: "#ff8888" }}>
                {c}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveContact(c)}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "#ff4444" }}
                data-ocid={`alarm.remove_contact.${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          {contacts.length === 0 && (
            <div
              className="text-xs text-center py-2"
              style={{ color: "#4a3333" }}
            >
              Henüz acil kişi eklenmedi
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={triggerWord.length < 3}
            className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, rgba(200,0,0,0.3), rgba(100,0,0,0.2))",
              border: "1px solid rgba(255,34,34,0.5)",
              color: "#ff2222",
              boxShadow:
                triggerWord.length >= 3
                  ? "0 0 20px rgba(255,34,34,0.2)"
                  : "none",
            }}
            data-ocid="alarm.save_button"
          >
            {saved ? "✅ KAYDEDİLDİ" : "💾 ALARMI KAYDET"}
          </button>

          {alarmActive && (
            <button
              type="button"
              onClick={handleDemoTrigger}
              className="w-full py-3 rounded-xl font-bold text-xs tracking-widest uppercase transition-all"
              style={{
                background: "rgba(255,100,0,0.1)",
                border: "1px solid rgba(255,100,0,0.3)",
                color: "#ff8800",
              }}
              data-ocid="alarm.demo_button"
            >
              🧪 TEST ET — DEMO TETİK
            </button>
          )}

          {alarmActive && (
            <button
              type="button"
              onClick={handleDeactivate}
              className="w-full py-2 rounded-xl font-bold text-xs tracking-widest uppercase transition-all"
              style={{ border: "1px solid rgba(80,80,80,0.2)", color: "#555" }}
              data-ocid="alarm.deactivate_button"
            >
              ALARMI DEVRE DIŞI BIRAK
            </button>
          )}
        </div>

        {/* Spy info */}
        <div
          className="mt-8 rounded-xl p-4 text-xs leading-relaxed"
          style={{
            background: "rgba(180,0,0,0.04)",
            border: "1px dashed rgba(180,0,0,0.2)",
            color: "#7a5555",
          }}
        >
          <div className="font-bold mb-1" style={{ color: "#ff4444" }}>
            🛡️ GİZLİLİK PROTOKOLÜ
          </div>
          Tetik sözcüğü cihazınızda kalır. Sunucuya hiç gönderilmez. Alarm
          tetiklendiğinde yalnızca anonim konum sinyali iletilir. Ekranda hiçbir
          görsel iz bırakılmaz.
        </div>
      </div>
    </div>
  );
}
