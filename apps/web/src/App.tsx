import { useState, useEffect } from "react";
import "./index.css";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { HowItWorks } from "./components/HowItWorks";
import { MeetingCompanionLanding } from "./components/meeting-companion/MeetingCompanionLanding";
import { InteractiveDemo } from "./components/InteractiveDemo";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { EarlyAccessModal } from "./components/EarlyAccessModal";
import { MeetingDashboard } from "./components/meeting-companion/MeetingDashboard";
import { MeetingWorkspace } from "./components/meeting-companion/MeetingWorkspace";
import { NewMeetingModal } from "./components/meeting-companion/NewMeetingModal";
import { getCurrentUser, getUserMeetings } from "./lib/userStore";
import type { MeetingRecord } from "./data/meetingCompanionData";

export default function App() {
  type AppView = "landing" | "companion-dashboard" | "companion-workspace";
  const [currentView, setCurrentView] = useState<AppView>("landing");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false);
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);

  // Sync hash routing if user enters #/meetings or #/meetings/:id
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/meetings/")) {
        const id = hash.replace("#/meetings/", "");
        setSelectedMeetingId(id);
        setCurrentView("companion-workspace");
      } else if (hash === "#/meetings") {
        setCurrentView("companion-dashboard");
      } else {
        setCurrentView("landing");
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleOpenBetaModal = () => {
    setIsBetaModalOpen(true);
  };

  const handleCloseBetaModal = () => {
    setIsBetaModalOpen(false);
  };

  const handleScrollToDemo = () => {
    const demoEl = document.querySelector("#demo");
    if (demoEl) {
      demoEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSelectMeeting = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    window.location.hash = `#/meetings/${meetingId}`;
    setCurrentView("companion-workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToDashboard = () => {
    window.location.hash = "#/meetings";
    setCurrentView("companion-dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToHome = () => {
    window.location.hash = "";
    setCurrentView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Find the selected meeting strictly in the current user's meetings
  const currentUser = getCurrentUser();
  const userMeetings = getUserMeetings(currentUser.id);
  const activeMeetingRecord: MeetingRecord | undefined = userMeetings.find(
    (m) => m.id === selectedMeetingId
  );

  return (
    <div className="voxflow-app" style={{ minHeight: "100vh", position: "relative" }}>
      {/* Subtle ambient background glow */}
      <div className="ambient-bg" aria-hidden="true" />

      {/* VIEW 1: MEETING DASHBOARD */}
      {currentView === "companion-dashboard" && (
        <MeetingDashboard
          onSelectMeeting={handleSelectMeeting}
          onBackToHome={handleBackToHome}
          onOpenNewMeetingModal={() => setIsNewMeetingModalOpen(true)}
        />
      )}

      {/* VIEW 2: MEETING WORKSPACE */}
      {currentView === "companion-workspace" && (
        activeMeetingRecord ? (
          <MeetingWorkspace
            meeting={activeMeetingRecord}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : (
          <div style={{ minHeight: "100vh", padding: "80px 20px", textAlign: "center", background: "#fbf9fe" }}>
            <div style={{ maxWidth: "480px", margin: "0 auto", background: "#ffffff", padding: "40px", borderRadius: "20px", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔍</div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                Meeting Record Not Found
              </h2>
              <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6, marginBottom: "24px" }}>
                This meeting does not exist or does not belong to your account (<strong>{currentUser.email}</strong>).
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBackToDashboard}
              >
                ← Return to My Meetings
              </button>
            </div>
          </div>
        )
      )}

      {/* VIEW 3: MAIN LANDING PAGE */}
      {currentView === "landing" && (
        <>
          {/* Navigation */}
          <Navbar onOpenBetaModal={handleOpenBetaModal} />

          {/* Main Content */}
          <main id="main-content">
            {/* Hero Section */}
            <Hero
              onOpenBetaModal={handleOpenBetaModal}
              onScrollToDemo={handleScrollToDemo}
            />

            {/* Core Features */}
            <Features />

            {/* How It Works (3 Steps + Optional Technical Details) */}
            <HowItWorks />

            {/* Interactive Product Demo */}
            <InteractiveDemo />

            {/* Meeting Companion (Honest Planned Feature / Coming Soon Preview) */}
            <MeetingCompanionLanding />

            {/* FAQ Accordion */}
            <FAQ />
          </main>

          {/* Footer */}
          <Footer onOpenBetaModal={handleOpenBetaModal} />
        </>
      )}

      {/* Early Access / Beta Modal */}
      <EarlyAccessModal
        isOpen={isBetaModalOpen}
        onClose={handleCloseBetaModal}
      />

      {/* New Meeting Modal */}
      <NewMeetingModal
        isOpen={isNewMeetingModalOpen}
        onClose={() => setIsNewMeetingModalOpen(false)}
        onStartMeeting={handleSelectMeeting}
      />
    </div>
  );
}