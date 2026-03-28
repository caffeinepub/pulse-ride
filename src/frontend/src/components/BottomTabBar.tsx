import { Car, Ghost, Home, Menu, Package, Truck } from "lucide-react";

type Tab = "home" | "rider" | "driver" | "ghost" | "delivery" | "more";

interface BottomTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Ana Sayfa", icon: <Home className="w-5 h-5" /> },
  { id: "rider", label: "Yolcu", icon: <Car className="w-5 h-5" /> },
  { id: "driver", label: "Şoför", icon: <Truck className="w-5 h-5" /> },
  { id: "ghost", label: "Ghost", icon: <Ghost className="w-5 h-5" /> },
  { id: "delivery", label: "Teslimat", icon: <Package className="w-5 h-5" /> },
  { id: "more", label: "Daha Fazla", icon: <Menu className="w-5 h-5" /> },
];

export default function BottomTabBar({
  activeTab,
  onTabChange,
}: BottomTabBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        background: "#FFFFFF",
        borderTop: "1px solid #E5E7EB",
        height: "64px",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      data-ocid="bottombar.panel"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            style={{ color: isActive ? "#276EF1" : "#9CA3AF" }}
            data-ocid={`bottombar.${tab.id}.tab`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
