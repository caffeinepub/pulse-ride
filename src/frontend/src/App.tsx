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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060812] to-[#0a0f1e]">
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
      <Toaster />
    </div>
  );
}
