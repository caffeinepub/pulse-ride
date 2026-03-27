import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed in standalone mode — don't show
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Already dismissed this session
    if (sessionStorage.getItem("pwa-banner-dismissed")) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      dismiss();
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    sessionStorage.setItem("pwa-banner-dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-ocid="pwa.toast"
      className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-[#060812]/95 px-4 py-3 shadow-[0_0_20px_rgba(0,255,255,0.08)] backdrop-blur-md"
    >
      <img
        src="/assets/generated/pwa-icon-192.dim_192x192.png"
        alt="PulseRide"
        className="h-10 w-10 rounded-lg border border-cyan-500/20 object-cover"
      />
      <div className="flex-1 min-w-0">
        {isIOS ? (
          <>
            <p className="text-xs font-bold tracking-wider text-cyan-400">
              📲 ANA EKRANA EKLE
            </p>
            <p className="text-[11px] text-cyan-600 leading-tight mt-0.5">
              Safari'de{" "}
              <span className="text-cyan-400 font-semibold">Paylaş</span> →{" "}
              <span className="text-cyan-400 font-semibold">
                Ana Ekrana Ekle
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold tracking-wider text-cyan-400">
              📲 UYGULAMAYI KUR
            </p>
            <p className="text-[11px] text-cyan-600 leading-tight mt-0.5">
              PulseRide'ı telefona uygulama olarak ekle
            </p>
          </>
        )}
      </div>
      {!isIOS && (
        <button
          type="button"
          data-ocid="pwa.primary_button"
          onClick={handleInstall}
          className="shrink-0 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold tracking-widest text-cyan-300 transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_10px_rgba(0,255,255,0.3)]"
        >
          EKLE
        </button>
      )}
      <button
        type="button"
        data-ocid="pwa.close_button"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-cyan-600 transition-colors hover:text-cyan-400"
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
}
