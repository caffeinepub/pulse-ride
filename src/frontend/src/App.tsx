import { Toaster } from "@/components/ui/sonner";
import DriverDashboard from "@/pages/DriverDashboard";
import GhostChatPage from "@/pages/GhostChatPage";
import LandingPage from "@/pages/LandingPage";
import LiveRideMapPage from "@/pages/LiveRideMapPage";
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
  | "live-map";

export interface SessionState {
  sessionId: string;
  role: "rider" | "driver";
}

export default function App() {
  const [view, setView] = useState<AppView>("landing");
  const [session, setSession] = useState<SessionState | null>(null);

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
      {view === "landing" && (
        <LandingPage
          onRideNow={() => setView("session-start-rider")}
          onJoinDriver={() => setView("session-start-driver")}
          onViralMode={() => setView("viral-mode")}
          onSecureComm={() => setView("secure-comm")}
          onGhostChat={() => setView("ghost-chat")}
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
      <Toaster />
    </div>
  );
}
