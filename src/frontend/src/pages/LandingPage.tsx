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
  onGhostGroup: () => void;
  onGhostAlarm?: () => void;
}

const FEATURES = [
  {
    icon: Lock,
    title: "GPS Şifreleme",
    desc: "Konumunuz cihazınızdan çıkmadan şifrelenir. Koordinatlar oturum anahtarlarıyla korunur.",
    accent: "#276EF1",
  },
  {
    icon: Eye,
    title: "Phantom Mod",
    desc: "AI tarafından oluşturulan sahte yolcular ve rastgele rotalar gerçek hareketleri gizler.",
    accent: "#7C3AED",
  },
  {
    icon: Zap,
    title: "Geçici Kimlikler",
    desc: "Tek kullanımlık kriptografik oturum kodları — her yolculuk yeni kod üretir, otomatik sona erer.",
    accent: "#276EF1",
  },
  {
    icon: Shield,
    title: "AI Güvenlik",
    desc: "Gerçek zamanlı anormallik tespiti, kişisel veri saklamadan. Sıfır bilgi doğrulaması.",
    accent: "#05944F",
  },
  {
    icon: Flame,
    title: "Viral Mod",
    desc: "Anonim yolculuk paylaşımları, mini oyunlar, liderlik tablosu — kimliğinizi açıklamadan viral olun.",
    accent: "#E11900",
  },
];

const CHAT_MSGS = [
  { text: "Oturum güvende 🔐", side: "left" },
  { text: "3 dakika sonra burada ✓", side: "right" },
  { text: "Mavi bölgedeyim 📍", side: "left" },
];

const REP_ITEMS = [
  { label: "Yüksek Güven", rides: 28, color: "#276EF1" },
  { label: "Doğrulanmış", rides: 14, color: "#05944F" },
  { label: "Güvenilir", rides: 7, color: "#276EF1" },
];

const RATING_BARS = [
  { stars: 5, pct: 68 },
  { stars: 4, pct: 22 },
  { stars: 3, pct: 7 },
];

const QUICK_FEATURES = [
  { label: "👻 Ghost Chat", key: "ghostChat" },
  { label: "👥 Ghost Group", key: "ghostGroup" },
  { label: "🔒 Secure Comm", key: "secureComm" },
  { label: "🚨 Ghost Alarm", key: "ghostAlarm" },
  { label: "🔥 Viral Mod", key: "viralMode" },
];

export default function LandingPage({
  onRideNow,
  onJoinDriver,
  onViralMode,
  onSecureComm,
  onGhostChat,
  onGhostGroup,
  onGhostAlarm,
}: LandingPageProps) {
  const featuresRef = useRef<HTMLDivElement>(null);

  const handleChipClick = (key: string) => {
    if (key === "ghostChat") onGhostChat();
    else if (key === "ghostGroup") onGhostGroup();
    else if (key === "secureComm") onSecureComm();
    else if (key === "ghostAlarm" && onGhostAlarm) onGhostAlarm();
    else if (key === "viralMode") onViralMode();
  };

  return (
    <div className="relative bg-white min-h-screen pb-20">
      {/* Hero — dark top section */}
      <div
        className="relative overflow-hidden"
        style={{ background: "#141414", minHeight: "380px" }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('/assets/generated/hero-city-night.dim_1920x1080.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.25,
          }}
        />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-xl tracking-widest">
              PULSE
            </span>
            <span
              style={{ color: "#276EF1" }}
              className="font-black text-xl tracking-widest"
            >
              RIDE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm text-gray-300 hover:text-white transition-colors px-3 py-1"
              data-ocid="nav.login.link"
            >
              Giriş
            </button>
            <button
              type="button"
              onClick={onRideNow}
              className="text-sm font-semibold px-4 py-1.5 rounded-full text-white"
              style={{ background: "#276EF1" }}
              data-ocid="nav.signup.button"
            >
              Başla
            </button>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 px-5 pt-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{
                background: "rgba(39,110,241,0.25)",
                color: "#60a5fa",
                border: "1px solid rgba(39,110,241,0.4)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#276EF1] animate-pulse" />
              Anonim Yolculuk Platformu
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight">
              Nereye gitmek
              <br />
              <span style={{ color: "#276EF1" }}>istiyorsunuz?</span>
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              Kimlik yok. Tam gizlilik. AI navigasyonlu güvenli yolculuklar.
            </p>
          </motion.div>

          {/* Destination search bar — Uber style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <button
              type="button"
              onClick={onRideNow}
              className="w-full flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-2xl text-left"
              data-ocid="hero.search_bar.button"
            >
              <div className="w-3 h-3 rounded-full bg-[#276EF1] flex-shrink-0" />
              <span className="text-gray-400 text-base flex-1">
                Nereye gidiyorsunuz?
              </span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#276EF1" }}
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Action cards */}
      <div className="px-5 -mt-4 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            type="button"
            onClick={onRideNow}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-2xl p-4 text-left shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
            data-ocid="hero.ride_now.primary_button"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(39,110,241,0.1)" }}
            >
              <Radio className="w-5 h-5" style={{ color: "#276EF1" }} />
            </div>
            <p className="font-bold text-[#141414] text-sm">YOLCU OL</p>
            <p className="text-gray-500 text-xs mt-0.5">Anonim yolculuk</p>
          </motion.button>

          <motion.button
            type="button"
            onClick={onJoinDriver}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="bg-[#141414] rounded-2xl p-4 text-left shadow-lg hover:bg-[#1e1e1e] transition-colors"
            data-ocid="hero.join_driver.secondary_button"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(5,148,79,0.15)" }}
            >
              <Zap className="w-5 h-5" style={{ color: "#05944F" }} />
            </div>
            <p className="font-bold text-white text-sm">ŞOFÖR OL</p>
            <p className="text-gray-400 text-xs mt-0.5">Yolcu al, kazan</p>
          </motion.button>
        </div>
      </div>

      {/* Quick feature chips */}
      <div className="px-5 mt-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Hızlı Erişim
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_FEATURES.map((feat) => (
            <button
              key={feat.key}
              type="button"
              onClick={() => handleChipClick(feat.key)}
              className="flex-shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#141414] hover:bg-gray-50 transition-colors shadow-sm"
              data-ocid={`feature.${feat.key}.button`}
            >
              {feat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Viral Mode Banner */}
      <div className="px-5 mt-5">
        <motion.button
          type="button"
          onClick={onViralMode}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="w-full rounded-2xl p-4 flex items-center gap-4 text-left hover:opacity-95 transition-opacity"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(255,107,53,0.3)",
          }}
          data-ocid="hero.viral_mode.button"
        >
          <span className="text-3xl">🔥</span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">VIRAL MOD</p>
            <p className="text-gray-400 text-xs mt-0.5">
              Anonim snapshots, mini oyunlar, liderlik
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-orange-400" />
        </motion.button>
      </div>

      {/* Mode cards section */}
      <div className="px-5 mt-6" ref={featuresRef}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Güvenlik Özellikleri
        </p>
        <div className="space-y-3">
          {/* Ghost Comm */}
          <motion.button
            type="button"
            onClick={onSecureComm}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 text-left shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            data-ocid="mode.secure_comm.button"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(39,110,241,0.1)" }}
            >
              <Lock className="w-6 h-6" style={{ color: "#276EF1" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#141414] text-sm">GHOST COMM</p>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{
                    background: "rgba(39,110,241,0.1)",
                    color: "#276EF1",
                  }}
                >
                  YENİ
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                AI ses maskeleme · Gerçek zamanlı · Sıfır iz
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>

          {/* Ghost Chat */}
          <motion.button
            type="button"
            onClick={onGhostChat}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 text-left shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            data-ocid="mode.ghost_chat.button"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: "rgba(124,58,237,0.1)" }}
            >
              👻
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#141414] text-sm">GHOST CHAT</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Şifreli mesajlaşma · Otomatik silinir · P2P
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>

          {/* Ghost Group */}
          <motion.button
            type="button"
            onClick={onGhostGroup}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 text-left shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            data-ocid="hero.ghost_group.button"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: "rgba(5,148,79,0.1)" }}
            >
              👥
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#141414] text-sm">GHOST GROUP</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Grup sohbeti · 10 kişi · Anonim
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>

          {/* Ghost Alarm */}
          {onGhostAlarm && (
            <motion.button
              type="button"
              onClick={onGhostAlarm}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 text-left shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              data-ocid="hero.ghost_alarm.button"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                style={{ background: "rgba(225,25,0,0.1)" }}
              >
                🚨
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#141414] text-sm">GHOST ALARM</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Sesli panik kodu · Gizli tetik
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Features grid */}
      <div className="px-5 mt-8">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Teknoloji
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              onClick={feat.title === "Viral Mod" ? onViralMode : undefined}
              style={{
                cursor: feat.title === "Viral Mod" ? "pointer" : "default",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${feat.accent}15` }}
              >
                <feat.icon
                  className="w-4.5 h-4.5"
                  style={{ color: feat.accent }}
                />
              </div>
              <p className="font-bold text-[#141414] text-xs mb-1">
                {feat.title}
              </p>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Trust section */}
      <div className="px-5 mt-8">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Topluluk & Güven
        </p>
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <MessageSquare
              className="w-7 h-7 mb-3"
              style={{ color: "#276EF1" }}
            />
            <h3 className="font-bold text-[#141414] text-sm mb-2">
              Şifreli Sohbet
            </h3>
            <p className="text-gray-500 text-xs mb-3">
              Sürücü ve yolcu arasında uçtan uca şifreli mesajlaşma.
            </p>
            <div className="space-y-1.5">
              {CHAT_MSGS.map((msg) => (
                <div
                  key={msg.text}
                  className={`text-xs px-3 py-1.5 rounded-lg ${
                    msg.side === "left"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <Shield className="w-6 h-6 mb-2" style={{ color: "#276EF1" }} />
              <h3 className="font-bold text-[#141414] text-xs mb-2">
                Güven Rozeti
              </h3>
              <div className="space-y-1.5">
                {REP_ITEMS.map((rep) => (
                  <div
                    key={rep.label}
                    className="flex items-center justify-between text-[10px]"
                  >
                    <span className="font-medium" style={{ color: rep.color }}>
                      {rep.label}
                    </span>
                    <span className="text-gray-400">{rep.rides}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <Star className="w-6 h-6 mb-2" style={{ color: "#f5c84b" }} />
              <h3 className="font-bold text-[#141414] text-xs mb-2">
                Puanlama
              </h3>
              <div className="space-y-1.5">
                {RATING_BARS.map(({ stars, pct }) => (
                  <div key={stars} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 w-4">
                      {stars}★
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-10 border-t border-gray-100 bg-[#141414] py-8 px-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white font-black tracking-widest text-sm">
            PULSE
          </span>
          <span
            style={{ color: "#276EF1" }}
            className="font-black tracking-widest text-sm"
          >
            RIDE
          </span>
        </div>
        <p className="text-gray-400 text-xs leading-relaxed mb-4">
          Anonim. Şifreli. Gizlilik odaklı nesil için AI destekli ulaşım.
        </p>
        <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              className="hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#276EF1" }}
            >
              caffeine.ai
            </a>
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Lock className="w-3 h-3 text-[#276EF1]" />
            Tüm oturumlar anonim ve şifreli
          </div>
        </div>
      </footer>
    </div>
  );
}
