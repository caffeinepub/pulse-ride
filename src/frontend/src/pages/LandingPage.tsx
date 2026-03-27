import {
  ChevronRight,
  Eye,
  Flame,
  Lock,
  MessageSquare,
  Radio,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";

interface LandingPageProps {
  onRideNow: () => void;
  onJoinDriver: () => void;
  onViralMode: () => void;
  onSecureComm: () => void;
  onGhostChat: () => void;
}

const WAVE_HEIGHTS = [
  { h: 0.4, id: "w1" },
  { h: 0.7, id: "w2" },
  { h: 1, id: "w3" },
  { h: 0.8, id: "w4" },
  { h: 0.5, id: "w5" },
  { h: 0.9, id: "w6" },
  { h: 0.6, id: "w7" },
];
const FOOTER_WAVE_HEIGHTS = [
  { h: 0.4, id: "fw1" },
  { h: 0.7, id: "fw2" },
  { h: 1, id: "fw3" },
  { h: 0.8, id: "fw4" },
  { h: 0.5, id: "fw5" },
];
const CHAT_MSGS = [
  { text: "Session secured 🔐", side: "left" },
  { text: "Pickup in 3 min ✓", side: "right" },
  { text: "I'm in the blue zone 📍", side: "left" },
];
const REP_ITEMS = [
  { label: "High Trust", rides: 28, color: "#2ee6d6" },
  { label: "Verified", rides: 14, color: "#a855ff" },
  { label: "Trusted", rides: 7, color: "#2ee6d6" },
];
const RATING_BARS = [
  { stars: 5, pct: 68 },
  { stars: 4, pct: 22 },
  { stars: 3, pct: 7 },
];
const FOOTER_COLS = [
  {
    title: "PRODUCT",
    links: ["How It Works", "Features", "Pricing", "Enterprise"],
  },
  {
    title: "SECURITY",
    links: ["Encryption", "Privacy Policy", "Bug Bounty", "Compliance"],
  },
  {
    title: "COMPANY",
    links: ["About", "Blog", "Careers", "Contact"],
  },
];
const NAV_ITEMS = ["Rider", "Driver", "Features", "Security", "Viral Mod"];
const FEATURES = [
  {
    icon: Lock,
    title: "CLIENT-SIDE GPS ENCRYPTION",
    desc: "Your location is encrypted before it ever leaves your device. Coordinates are hashed with session-unique keys that expire with your ride.",
    accent: "#a855ff",
  },
  {
    icon: Eye,
    title: "PHANTOM RIDE MODE",
    desc: "AI-generated decoy passengers and randomized routes make it impossible to track actual movement patterns in the network.",
    accent: "#2ee6d6",
  },
  {
    icon: Zap,
    title: "SESSION-BASED TEMP IDs",
    desc: "Single-use cryptographic session codes replace identities. Each ride generates new codes — usable only once, expiring automatically.",
    accent: "#a855ff",
  },
  {
    icon: Shield,
    title: "AI SECURITY MONITORING",
    desc: "Real-time behavioral analysis detects anomalies without storing personal data. Disputes resolved through zero-knowledge verification.",
    accent: "#2ee6d6",
  },
  {
    icon: Flame,
    title: "VIRAL MOD",
    desc: "Share anonymous ride snapshots, compete on the leaderboard, play mini-games, and go viral — all without revealing your identity.",
    accent: "#ff6b35",
  },
];

export default function LandingPage({
  onRideNow,
  onJoinDriver,
  onViralMode,
  onSecureComm,
  onGhostChat,
}: LandingPageProps) {
  const featuresRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url('/assets/generated/hero-city-night.dim_1920x1080.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#060812]/85 via-[#060812]/70 to-[#060812]/95" />
        <div className="absolute inset-0 grid-overlay" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5 glass-card">
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-0.5 h-6">
            {WAVE_HEIGHTS.map(({ h, id }, i) => (
              <div
                key={id}
                className="w-1 bg-pulse-cyan rounded-full animate-waveform"
                style={{ height: `${h * 24}px`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
          <span
            className="text-lg font-bold tracking-widest uppercase glow-text-cyan"
            style={{ color: "#2ee6d6" }}
          >
            PULSE RIDE
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                if (item === "Features" || item === "Security")
                  scrollTo(featuresRef);
                else if (item === "Viral Mod") onViralMode();
              }}
              className="text-sm font-medium tracking-wider uppercase transition-colors"
              style={{
                color: item === "Viral Mod" ? "#ff6b35" : "#a7b0c2",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  item === "Viral Mod" ? "#ff9166" : "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  item === "Viral Mod" ? "#ff6b35" : "#a7b0c2";
              }}
              data-ocid={`nav.${item.toLowerCase().replace(" ", "_")}.link`}
            >
              {item === "Viral Mod" ? (
                <span className="flex items-center gap-1">🔥 {item}</span>
              ) : (
                item
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm font-medium text-[#a7b0c2] hover:text-white transition-colors tracking-wider"
            data-ocid="nav.login.link"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={onRideNow}
            className="btn-secondary px-5 py-2 rounded-full text-sm font-semibold tracking-wider uppercase"
            data-ocid="nav.signup.button"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex items-center px-6 md:px-12 pt-16">
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase border border-pulse-purple/30 bg-pulse-purple/10 text-pulse-purple">
              <span className="w-2 h-2 rounded-full bg-pulse-cyan animate-pulse" />
              Next-Gen Anonymous Transit
            </div>

            <h1 className="text-4xl md:text-6xl font-black uppercase leading-none tracking-tight">
              <span className="text-white">RIDE ANONYMOUS.</span>
              <br />
              <span className="text-white">RIDE SAFE.</span>
              <br />
              <span className="glow-text-cyan" style={{ color: "#2ee6d6" }}>
                PULSE RIDE.
              </span>
            </h1>

            <p className="text-[#a7b0c2] text-base md:text-lg leading-relaxed max-w-lg">
              Zero identity. Full privacy. AI-navigated routes with end-to-end
              encryption. Your journey — invisible to everyone except the road.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <button
                type="button"
                onClick={onRideNow}
                className="btn-primary px-8 py-3.5 rounded-full text-white font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2"
                data-ocid="hero.ride_now.primary_button"
              >
                RIDE NOW <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onJoinDriver}
                className="btn-secondary px-8 py-3.5 rounded-full font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2"
                data-ocid="hero.join_driver.secondary_button"
              >
                JOIN AS DRIVER <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onViralMode}
                className="px-8 py-3.5 rounded-full font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,107,53,0.25), rgba(255,107,53,0.1))",
                  border: "1px solid rgba(255,107,53,0.5)",
                  color: "#ff9166",
                  boxShadow: "0 0 20px rgba(255,107,53,0.15)",
                }}
                data-ocid="hero.viral_mode.button"
              >
                🔥 VIRAL MOD
              </button>
              <button
                type="button"
                onClick={onSecureComm}
                className="px-8 py-3.5 rounded-full font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,245,255,0.2), rgba(0,245,255,0.05))",
                  border: "1px solid rgba(0,245,255,0.5)",
                  color: "#00f5ff",
                  boxShadow: "0 0 20px rgba(0,245,255,0.15)",
                }}
                data-ocid="hero.secure_comm.button"
              >
                🔒 SECURE COMM
              </button>
              <button
                type="button"
                onClick={onGhostChat}
                className="px-8 py-3.5 rounded-full font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(0,255,247,0.08))",
                  border: "1px solid rgba(168,85,247,0.5)",
                  color: "#c084fc",
                  boxShadow: "0 0 20px rgba(168,85,247,0.2)",
                }}
                data-ocid="hero.ghost_chat.button"
              >
                👻 GHOST CHAT
              </button>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-[#a7b0c2]">
                <Lock className="w-3.5 h-3.5" style={{ color: "#2ee6d6" }} />
                End-to-end encrypted
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#a7b0c2]">
                <Eye className="w-3.5 h-3.5" style={{ color: "#a855ff" }} />
                Zero profile required
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#a7b0c2]">
                <Zap className="w-3.5 h-3.5" style={{ color: "#2ee6d6" }} />
                AI-matched instantly
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            className="relative hidden md:block"
          >
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(168,85,255,0.15) 0%, transparent 70%)",
              }}
            />
            <img
              src="/assets/generated/hero-car.dim_800x500.png"
              alt="Pulse Ride vehicle"
              className="relative z-10 w-full animate-float drop-shadow-2xl"
              style={{
                filter:
                  "drop-shadow(0 0 40px rgba(46,230,214,0.3)) drop-shadow(0 0 80px rgba(168,85,255,0.2))",
              }}
            />
          </motion.div>
        </div>
      </section>

      {/* Mode Cards */}
      <section className="relative z-10 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-[0.12em] text-white mb-3">
              CHOOSE YOUR MODE
            </h2>
            <div
              className="w-16 h-0.5 mx-auto"
              style={{ background: "linear-gradient(90deg, #a855ff, #2ee6d6)" }}
            />
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Rider Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card rounded-2xl p-8 glow-purple group cursor-pointer hover:scale-[1.01] transition-all"
              onClick={onRideNow}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(168,85,255,0.15)",
                  border: "1px solid rgba(168,85,255,0.4)",
                }}
              >
                <Radio className="w-7 h-7" style={{ color: "#a855ff" }} />
              </div>
              <h3
                className="text-xl font-bold uppercase tracking-widest mb-3"
                style={{ color: "#a855ff" }}
              >
                RIDER
              </h3>
              <p className="text-[#a7b0c2] text-sm leading-relaxed mb-6">
                Request anonymous rides with zero identity disclosure. Encrypted
                pickup zones, Phantom Mode, and AI-matched drivers — all without
                giving away who you are.
              </p>
              <button
                type="button"
                onClick={onRideNow}
                className="btn-primary px-6 py-2.5 rounded-full text-white font-semibold tracking-wider uppercase text-sm"
                data-ocid="mode.rider.primary_button"
              >
                START RIDING
              </button>
            </motion.div>

            {/* Driver Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card-cyan rounded-2xl p-8 glow-cyan group cursor-pointer hover:scale-[1.01] transition-all"
              onClick={onJoinDriver}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(46,230,214,0.12)",
                  border: "1px solid rgba(46,230,214,0.35)",
                }}
              >
                <Zap className="w-7 h-7" style={{ color: "#2ee6d6" }} />
              </div>
              <h3
                className="text-xl font-bold uppercase tracking-widest mb-3"
                style={{ color: "#2ee6d6" }}
              >
                DRIVER
              </h3>
              <p className="text-[#a7b0c2] text-sm leading-relaxed mb-6">
                Navigate AI-guided routes without ever knowing your passenger's
                identity. Earn trust scores, accept anonymous rides, and
                experience the future of transit.
              </p>
              <button
                type="button"
                onClick={onJoinDriver}
                className="btn-secondary px-6 py-2.5 rounded-full font-semibold tracking-wider uppercase text-sm"
                data-ocid="mode.driver.secondary_button"
              >
                START DRIVING
              </button>
            </motion.div>
          </div>

          {/* Secure Comm Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 glass-card rounded-2xl p-8 cursor-pointer hover:scale-[1.005] transition-all"
            style={{
              borderColor: "rgba(0,245,255,0.25)",
              boxShadow: "0 0 30px rgba(0,245,255,0.05)",
            }}
            onClick={onSecureComm}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(0,245,255,0.1)",
                  border: "1px solid rgba(0,245,255,0.35)",
                }}
              >
                <Lock className="w-7 h-7" style={{ color: "#00f5ff" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3
                    className="text-xl font-bold uppercase tracking-widest"
                    style={{ color: "#00f5ff" }}
                  >
                    GHOST COMM
                  </h3>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse"
                    style={{
                      background: "rgba(0,245,255,0.12)",
                      border: "1px solid rgba(0,245,255,0.4)",
                      color: "#00f5ff",
                    }}
                  >
                    NEW
                  </span>
                </div>
                <p className="text-[#a7b0c2] text-sm leading-relaxed mb-4">
                  Ultra-secure AI voice masking with real-time translation. Zero
                  biometric leakage, synthetic voice generation, ghost mode, and
                  ephemeral sessions. Your voice — unrecognizable, untraceable,
                  anonymous.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "AI Voice Masking",
                    "Real-Time Translation",
                    "Ghost Mode",
                    "Zero Storage",
                    "Anti-Fingerprint",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                      style={{
                        background: "rgba(0,245,255,0.08)",
                        border: "1px solid rgba(0,245,255,0.2)",
                        color: "#00f5ff",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSecureComm();
                }}
                className="shrink-0 px-6 py-2.5 rounded-full font-bold tracking-widest uppercase text-sm transition-all hover:opacity-90"
                style={{
                  background: "rgba(0,245,255,0.15)",
                  border: "1px solid rgba(0,245,255,0.5)",
                  color: "#00f5ff",
                  boxShadow: "0 0 16px rgba(0,245,255,0.2)",
                }}
                data-ocid="mode.secure_comm.button"
              >
                LAUNCH →
              </button>
            </div>
          </motion.div>

          {/* Ghost Chat Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 glass-card rounded-2xl p-8 cursor-pointer hover:scale-[1.005] transition-all"
            style={{
              borderColor: "rgba(168,85,247,0.3)",
              boxShadow: "0 0 30px rgba(168,85,247,0.06)",
            }}
            onClick={onGhostChat}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                style={{
                  background: "rgba(168,85,247,0.12)",
                  border: "1px solid rgba(168,85,247,0.4)",
                }}
              >
                👻
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3
                    className="text-xl font-bold uppercase tracking-widest"
                    style={{ color: "#c084fc" }}
                  >
                    GHOST CHAT
                  </h3>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse"
                    style={{
                      background: "rgba(168,85,247,0.15)",
                      border: "1px solid rgba(168,85,247,0.45)",
                      color: "#c084fc",
                    }}
                  >
                    ULTRA GİZLİ
                  </span>
                </div>
                <p className="text-[#a7b0c2] text-sm leading-relaxed mb-4">
                  AI destekli emoji sohbet. Belge, konum ve fotoğraf paylaşımı —
                  tamamen şifreli, otomatik silinir. Hiçbir iz kalmaz.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "AI Emoji Önerisi",
                    "Şifreli Belge",
                    "Anonim Konum",
                    "Fotoğraf E2E",
                    "Otomatik Silinir",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                      style={{
                        background: "rgba(168,85,247,0.1)",
                        border: "1px solid rgba(168,85,247,0.25)",
                        color: "#c084fc",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGhostChat();
                }}
                className="shrink-0 px-6 py-2.5 rounded-full font-bold tracking-widest uppercase text-sm transition-all hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(0,255,247,0.1))",
                  border: "1px solid rgba(168,85,247,0.55)",
                  color: "#c084fc",
                  boxShadow: "0 0 16px rgba(168,85,247,0.25)",
                }}
                data-ocid="mode.ghost_chat.button"
              >
                BAŞLAT →
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section ref={featuresRef} className="relative z-10 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-[0.1em] text-white mb-3">
              FEATURED ULTRA-SECURE TECH
            </h2>
            <div
              className="w-16 h-0.5 mx-auto"
              style={{ background: "linear-gradient(90deg, #a855ff, #2ee6d6)" }}
            />
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 cursor-pointer hover:scale-[1.01] transition-all"
                style={{ borderColor: `${feat.accent}30` }}
                onClick={feat.title === "VIRAL MOD" ? onViralMode : undefined}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: `${feat.accent}18`,
                      border: `1px solid ${feat.accent}35`,
                    }}
                  >
                    <feat.icon
                      className="w-5 h-5"
                      style={{ color: feat.accent }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className="text-sm font-bold uppercase tracking-[0.08em]"
                        style={{ color: feat.accent }}
                      >
                        {feat.title}
                      </h3>
                      {feat.title === "VIRAL MOD" && (
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            background: "rgba(255,107,53,0.15)",
                            border: "1px solid rgba(255,107,53,0.4)",
                            color: "#ff9166",
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-[#a7b0c2] text-sm leading-relaxed">
                      {feat.desc}
                    </p>
                    {feat.title === "VIRAL MOD" && (
                      <button
                        type="button"
                        onClick={onViralMode}
                        className="mt-3 text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full transition-opacity hover:opacity-80"
                        style={{
                          background: "rgba(255,107,53,0.15)",
                          border: "1px solid rgba(255,107,53,0.4)",
                          color: "#ff9166",
                        }}
                        data-ocid="features.viral_mode.button"
                      >
                        🔥 Viral Mod'u Keşfet →
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Community */}
      <section className="relative z-10 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-[0.1em] text-white mb-3">
              TRUST & COMMUNITY
            </h2>
            <div
              className="w-16 h-0.5 mx-auto"
              style={{ background: "linear-gradient(90deg, #a855ff, #2ee6d6)" }}
            />
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Encrypted Chat */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="glass-card rounded-2xl p-6"
            >
              <MessageSquare
                className="w-8 h-8 mb-4"
                style={{ color: "#a855ff" }}
              />
              <h3 className="text-base font-bold uppercase tracking-wider mb-2 text-white">
                ENCRYPTED CHAT
              </h3>
              <p className="text-[#a7b0c2] text-sm leading-relaxed">
                End-to-end encrypted messages between rider and driver. Messages
                self-destruct when the session ends.
              </p>
              <div className="mt-4 space-y-2">
                {CHAT_MSGS.map((msg) => (
                  <div
                    key={msg.text}
                    className={`text-xs px-3 py-1.5 rounded-lg ${
                      msg.side === "left"
                        ? "bg-purple-500/10 text-purple-300 ml-4"
                        : "bg-cyan-500/10 text-cyan-300 mr-4"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Reputation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card rounded-2xl p-6"
            >
              <Shield className="w-8 h-8 mb-4" style={{ color: "#2ee6d6" }} />
              <h3 className="text-base font-bold uppercase tracking-wider mb-2 text-white">
                REPUTATION BADGE
              </h3>
              <p className="text-[#a7b0c2] text-sm leading-relaxed mb-4">
                Anonymous trust scores earned through successful rides. No names
                — just verified track records.
              </p>
              <div className="space-y-2">
                {REP_ITEMS.map((rep) => (
                  <div
                    key={rep.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium" style={{ color: rep.color }}>
                      {rep.label}
                    </span>
                    <span className="text-[#a7b0c2]">{rep.rides} rides</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Ratings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card rounded-2xl p-6"
            >
              <Star className="w-8 h-8 mb-4" style={{ color: "#f5c84b" }} />
              <h3 className="text-base font-bold uppercase tracking-wider mb-2 text-white">
                ANONYMOUS RATINGS
              </h3>
              <p className="text-[#a7b0c2] text-sm leading-relaxed mb-4">
                Rate your experience without revealing your identity. Stars only
                — no reviews, no tracking.
              </p>
              <div className="space-y-2">
                {RATING_BARS.map(({ stars, pct }) => (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-xs text-[#a7b0c2] w-4">{stars}★</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: "#f5c84b" }}
                      />
                    </div>
                    <span className="text-xs text-[#a7b0c2] w-8">{pct}%</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 border-t border-white/5 py-12 px-6 md:px-12"
        style={{ background: "rgba(4,6,14,0.95)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-end gap-0.5 h-5">
                  {FOOTER_WAVE_HEIGHTS.map(({ h, id }, i) => (
                    <div
                      key={id}
                      className="w-1 rounded-full"
                      style={{
                        height: `${h * 20}px`,
                        background: "#2ee6d6",
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <span
                  className="font-bold tracking-widest uppercase text-sm"
                  style={{ color: "#2ee6d6" }}
                >
                  PULSE RIDE
                </span>
              </div>
              <p className="text-xs text-[#a7b0c2] leading-relaxed">
                Anonymous. Encrypted. Intelligent transit for the privacy-first
                generation.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-white mb-3">
                  {col.title}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button
                        type="button"
                        className="text-xs text-[#a7b0c2] hover:text-white transition-colors"
                      >
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#a7b0c2]">
              © {new Date().getFullYear()}. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                className="hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#2ee6d6" }}
              >
                caffeine.ai
              </a>
            </p>
            <div
              className="flex items-center gap-1 text-xs"
              style={{ color: "#2ee6d6" }}
            >
              <Lock className="w-3 h-3" />
              All sessions are anonymous and encrypted
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
