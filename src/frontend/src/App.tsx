import BottomTabBar from "@/components/BottomTabBar";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { Toaster } from "@/components/ui/sonner";
import DriverDashboard from "@/pages/DriverDashboard";
import GhostAlarmSetupPage from "@/pages/GhostAlarmSetupPage";
import GhostChatPage from "@/pages/GhostChatPage";
import GhostDuelloPage from "@/pages/GhostDuelloPage";
import GhostGroupPage from "@/pages/GhostGroupPage";
import LandingPage from "@/pages/LandingPage";
import LiveRideMapPage from "@/pages/LiveRideMapPage";
import PulseMemoryBombPage from "@/pages/PulseMemoryBombPage";
import RiderDashboard from "@/pages/RiderDashboard";
import SecureCommPage from "@/pages/SecureCommPage";
import SessionStart from "@/pages/SessionStart";
import ViralModePage from "@/pages/ViralModePage";
import { useState } from "react";

export type AppView =
  | "landing"
  | "session-start-rider"
  | "session-start-driver"
  | "rider"
  | "driver"
  | "viral-mode"
  | "secure-comm"
  | "ghost-chat"
  | "live-map"
  | "ghost-group"
  | "ghost-duello"
  | "memory-bomb"
  | "ghost-alarm-setup";

export interface SessionState {
  sessionId: string;
  role: "rider" | "driver";
}

type BottomTab = "home" | "rider" | "driver" | "ghost" | "more";

const BOTTOM_BAR_VIEWS: AppView[] = ["landing", "rider", "driver"];

function getActiveTab(view: AppView, _session: SessionState | null): BottomTab {
  if (view === "landing") return "home";
  if (view === "rider" || view === "session-start-rider") return "rider";
  if (view === "driver" || view === "session-start-driver") return "driver";
  if (view === "ghost-chat" || view === "ghost-group") return "ghost";
  if (
    view === "ghost-alarm-setup" ||
    view === "viral-mode" ||
    view === "secure-comm"
  )
    return "more";
  return "home";
}

export default function App() {
  const [view, setView] = useState<AppView>("landing");
  const [session, setSession] = useState<SessionState | null>(null);
  const [userPrice, setUserPrice] = useState<number | null>(null);

  const handleSessionCreated = (
    sessionId: string,
    role: "rider" | "driver",
  ) => {
    setSession({ sessionId, role });
    setView(role);
  };

  const handleEndSession = () => {
    setSession(null);
    setView("landing");
  };

  const showBottomBar = BOTTOM_BAR_VIEWS.includes(view);
  const activeTab = getActiveTab(view, session);

  const handleTabChange = (tab: BottomTab) => {
    if (tab === "home") {
      setView("landing");
    } else if (tab === "rider") {
      if (session?.role === "rider") {
        setView("rider");
      } else {
        setView("session-start-rider");
      }
    } else if (tab === "driver") {
      if (session?.role === "driver") {
        setView("driver");
      } else {
        setView("session-start-driver");
      }
    } else if (tab === "ghost") {
      setView("ghost-chat");
    } else if (tab === "more") {
      setView("ghost-alarm-setup");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <PWAInstallBanner />
      {view === "landing" && (
        <LandingPage
          onRideNow={() => setView("session-start-rider")}
          onJoinDriver={() => setView("session-start-driver")}
          onViralMode={() => setView("viral-mode")}
          onSecureComm={() => setView("secure-comm")}
          onGhostChat={() => setView("ghost-chat")}
          onGhostGroup={() => setView("ghost-group")}
          onGhostAlarm={() => setView("ghost-alarm-setup")}
        />
      )}
      {(view === "session-start-rider" || view === "session-start-driver") && (
        <SessionStart
          role={view === "session-start-rider" ? "rider" : "driver"}
          onSessionCreated={handleSessionCreated}
          onBack={() => setView("landing")}
        />
      )}
      {view === "rider" && session && (
        <RiderDashboard
          session={session}
          onEndSession={handleEndSession}
          onLiveMap={() => setView("live-map")}
          onGhostDuello={(price) => {
            setUserPrice(price);
            setView("ghost-duello");
          }}
          onMemoryBomb={() => setView("memory-bomb")}
        />
      )}
      {view === "driver" && session && (
        <DriverDashboard
          session={session}
          onEndSession={handleEndSession}
          onLiveMap={() => setView("live-map")}
        />
      )}
      {view === "viral-mode" && (
        <ViralModePage onBack={() => setView("landing")} />
      )}
      {view === "secure-comm" && (
        <SecureCommPage onBack={() => setView("landing")} />
      )}
      {view === "ghost-chat" && (
        <GhostChatPage onBack={() => setView("landing")} />
      )}
      {view === "live-map" && <LiveRideMapPage onBack={handleEndSession} />}
      {view === "ghost-group" && (
        <GhostGroupPage onBack={() => setView("landing")} />
      )}
      {view === "ghost-duello" && session && userPrice !== null && (
        <GhostDuelloPage
          userPrice={userPrice}
          sessionId={session.sessionId}
          onBack={() => setView("rider")}
        />
      )}
      {view === "memory-bomb" && session && (
        <PulseMemoryBombPage
          sessionId={session.sessionId}
          onBack={() => setView("rider")}
        />
      )}
      {view === "ghost-alarm-setup" && (
        <GhostAlarmSetupPage onBack={() => setView("landing")} />
      )}
      {showBottomBar && (
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
      <Toaster />
    </div>
  );
}
