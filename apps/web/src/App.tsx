import { useState, useEffect } from "react";
import "./index.css";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { HowItWorks } from "./components/HowItWorks";
import { MeetingCompanionLanding } from "./components/meeting-companion/MeetingCompanionLanding";
import { InteractiveDemo } from "./components/InteractiveDemo";
import { Pricing } from "./components/Pricing";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { EarlyAccessModal } from "./components/EarlyAccessModal";
import { MeetingDashboard } from "./components/meeting-companion/MeetingDashboard";
import { MeetingWorkspace } from "./components/meeting-companion/MeetingWorkspace";
import { NewMeetingModal } from "./components/meeting-companion/NewMeetingModal";
import { getCurrentUser, getUserMeetings, saveUserMeeting, setCurrentUser as setStoredUser } from "./lib/userStore";
import { api } from "./lib/api";
import type { MeetingRecord } from "./data/meetingCompanionData";
import { PrivacyPolicy } from "./components/legal/PrivacyPolicy";
import { TermsOfService } from "./components/legal/TermsOfService";
import { RefundPolicy } from "./components/legal/RefundPolicy";
import { CookiePolicy } from "./components/legal/CookiePolicy";
import { CookieConsentBanner } from "./components/legal/CookieConsentBanner";
import { useAuth } from "./lib/authContext";
import { AuthPages } from "./components/auth/AuthPages";

export default function App() {
  type AppView =
    | "landing"
    | "companion-dashboard"
    | "companion-workspace"
    | "privacy"
    | "terms"
    | "refunds"
    | "cookies"
    | "login"
    | "signup"
    | "forgot-password"
    | "reset-password"
    | "verify";

  const [currentView, setCurrentView] = useState<AppView>("landing");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false);
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);
  const [isCookieSettingsModalOpen, setIsCookieSettingsModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [userMeetings, setUserMeetings] = useState<MeetingRecord[]>(() =>
    getUserMeetings(getCurrentUser().id)
  );
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);
  const [meetingLoadError, setMeetingLoadError] = useState<string | null>(null);

  const { user, loading, isConfigured } = useAuth();

  // Sync auth user with userStore
  useEffect(() => {
    if (user) {
      const authProfile = {
        id: user.id,
        name: user.name || "My Account",
        email: user.email,
        createdAt: new Date().toISOString()
      };
      setStoredUser(authProfile);
      setCurrentUser(authProfile);
      setUserMeetings(getUserMeetings(user.id));
    }
  }, [user]);

  // Sync hash routing if user enters #/meetings, #/login, #/signup, etc.
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || "";
      if (hash.startsWith("#/meetings/")) {
        const id = hash.replace("#/meetings/", "");
        setSelectedMeetingId(id);
        setCurrentView("companion-workspace");
      } else if (hash === "#/meetings") {
        setCurrentView("companion-dashboard");
      } else if (hash === "#/login" || hash.startsWith("#/login?")) {
        setCurrentView("login");
      } else if (hash === "#/signup" || hash.startsWith("#/signup?")) {
        setCurrentView("signup");
      } else if (hash === "#/forgot-password") {
        setCurrentView("forgot-password");
      } else if (hash.startsWith("#/reset-password")) {
        setCurrentView("reset-password");
      } else if (hash.startsWith("#/verify")) {
        setCurrentView("verify");
      } else if (hash === "#/privacy") {
        setCurrentView("privacy");
      } else if (hash === "#/terms") {
        setCurrentView("terms");
      } else if (hash === "#/refunds") {
        setCurrentView("refunds");
      } else if (hash === "#/cookies") {
        setCurrentView("cookies");
      } else {
        setCurrentView("landing");
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Route Protection & Intended Destination Guard
  useEffect(() => {
    if (loading) return; // Prevent flashing protected data before auth check completes

    const isMeetingRoute =
      currentView === "companion-dashboard" || currentView === "companion-workspace";

    // If Supabase is configured and user is unauthenticated on protected meeting route:
    if (isConfigured && !user && isMeetingRoute) {
      const safeReturnTo = encodeURIComponent(window.location.hash || "#/meetings");
      window.location.hash = `#/login?returnTo=${safeReturnTo}`;
      setCurrentView("login");
    }

    // If authenticated user visits login or signup, redirect to dashboard:
    if (user && (currentView === "login" || currentView === "signup")) {
      window.location.hash = "#/meetings";
      setCurrentView("companion-dashboard");
    }
  }, [loading, user, isConfigured, currentView]);

  // Listen for user store changes
  useEffect(() => {
    const handleSync = () => {
      const user = getCurrentUser();
      setCurrentUser(user);
      setUserMeetings(getUserMeetings(user.id));
    };

    window.addEventListener("voxflow_data_changed", handleSync);
    window.addEventListener("voxflow_user_changed", handleSync);
    return () => {
      window.removeEventListener("voxflow_data_changed", handleSync);
      window.removeEventListener("voxflow_user_changed", handleSync);
    };
  }, []);

  // Asynchronously resolve direct meeting URLs before displaying not-found screen
  useEffect(() => {
    if (currentView === "companion-workspace" && selectedMeetingId) {
      const existing = getUserMeetings(currentUser.id).find((m) => m.id === selectedMeetingId);
      if (existing) {
        setIsLoadingMeeting(false);
        setMeetingLoadError(null);
      } else {
        setIsLoadingMeeting(true);
        setMeetingLoadError(null);
        api
          .getMeeting(selectedMeetingId, currentUser.id)
          .then((res) => {
            if (res && res.meeting) {
              saveUserMeeting(currentUser.id, res.meeting);
              setUserMeetings(getUserMeetings(currentUser.id));
              setMeetingLoadError(null);
            } else {
              setMeetingLoadError("Meeting not found on server.");
            }
          })
          .catch((err) => {
            console.warn("Direct meeting fetch notice:", err);
            setMeetingLoadError(
              "Could not retrieve meeting from server. Please verify backend connection."
            );
          })
          .finally(() => {
            setIsLoadingMeeting(false);
          });
      }
    }
  }, [currentView, selectedMeetingId, currentUser.id]);

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
        isLoadingMeeting ? (
          <div style={{ minHeight: "100vh", padding: "100px 20px", textAlign: "center", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ maxWidth: "440px", margin: "0 auto", background: "#ffffff", padding: "36px 28px", borderRadius: "8px", border: "1px solid #e5e5e5" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid #e5e5e5", borderTopColor: "#111111", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
                Loading Meeting Workspace...
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0 }}>
                Retrieving transcript, decisions, and action items from server...
              </p>
            </div>
          </div>
        ) : activeMeetingRecord ? (
          <MeetingWorkspace
            meeting={activeMeetingRecord}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : (
          <div style={{ minHeight: "100vh", padding: "80px 20px", textAlign: "center", background: "#ffffff" }}>
            <div style={{ maxWidth: "440px", margin: "0 auto", background: "#ffffff", padding: "36px 28px", borderRadius: "8px", border: "1px solid #e5e5e5" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "50%", background: "#f5f5f5", color: "#111111", margin: "0 auto 14px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
                Meeting Record Not Found
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.6, marginBottom: "20px" }}>
                {meetingLoadError || (
                  <>This meeting does not exist or does not belong to your account (<strong>{currentUser.email}</strong>).</>
                )}
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBackToDashboard}
                style={{ fontSize: "0.875rem", padding: "9px 18px" }}
              >
                ← Return to Meetings
              </button>
            </div>
          </div>
        )
      )}

      {/* VIEW 3: LEGAL - PRIVACY POLICY */}
      {currentView === "privacy" && (
        <>
          <PrivacyPolicy onBackToHome={handleBackToHome} />
          <Footer
            onOpenBetaModal={handleOpenBetaModal}
            onNavigateToPrivacy={() => { window.location.hash = "#/privacy"; setCurrentView("privacy"); }}
            onNavigateToTerms={() => { window.location.hash = "#/terms"; setCurrentView("terms"); }}
            onNavigateToRefunds={() => { window.location.hash = "#/refunds"; setCurrentView("refunds"); }}
            onNavigateToCookies={() => { window.location.hash = "#/cookies"; setCurrentView("cookies"); }}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
        </>
      )}

      {/* VIEW 4: LEGAL - TERMS OF SERVICE */}
      {currentView === "terms" && (
        <>
          <TermsOfService onBackToHome={handleBackToHome} />
          <Footer
            onOpenBetaModal={handleOpenBetaModal}
            onNavigateToPrivacy={() => { window.location.hash = "#/privacy"; setCurrentView("privacy"); }}
            onNavigateToTerms={() => { window.location.hash = "#/terms"; setCurrentView("terms"); }}
            onNavigateToRefunds={() => { window.location.hash = "#/refunds"; setCurrentView("refunds"); }}
            onNavigateToCookies={() => { window.location.hash = "#/cookies"; setCurrentView("cookies"); }}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
        </>
      )}

      {/* VIEW 5: LEGAL - REFUND POLICY */}
      {currentView === "refunds" && (
        <>
          <RefundPolicy onBackToHome={handleBackToHome} />
          <Footer
            onOpenBetaModal={handleOpenBetaModal}
            onNavigateToPrivacy={() => { window.location.hash = "#/privacy"; setCurrentView("privacy"); }}
            onNavigateToTerms={() => { window.location.hash = "#/terms"; setCurrentView("terms"); }}
            onNavigateToRefunds={() => { window.location.hash = "#/refunds"; setCurrentView("refunds"); }}
            onNavigateToCookies={() => { window.location.hash = "#/cookies"; setCurrentView("cookies"); }}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
        </>
      )}

      {/* VIEW 6: LEGAL - COOKIE POLICY */}
      {currentView === "cookies" && (
        <>
          <CookiePolicy
            onBackToHome={handleBackToHome}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
          <Footer
            onOpenBetaModal={handleOpenBetaModal}
            onNavigateToPrivacy={() => { window.location.hash = "#/privacy"; setCurrentView("privacy"); }}
            onNavigateToTerms={() => { window.location.hash = "#/terms"; setCurrentView("terms"); }}
            onNavigateToRefunds={() => { window.location.hash = "#/refunds"; setCurrentView("refunds"); }}
            onNavigateToCookies={() => { window.location.hash = "#/cookies"; setCurrentView("cookies"); }}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
        </>
      )}

      {/* VIEW 7: AUTHENTICATION VIEWS */}
      {(currentView === "login" ||
        currentView === "signup" ||
        currentView === "forgot-password" ||
        currentView === "reset-password" ||
        currentView === "verify") && (
        <>
          <Navbar onOpenBetaModal={handleOpenBetaModal} />
          <AuthPages
            initialView={currentView}
            onNavigate={(newView) => {
              if (newView === "companion-dashboard") {
                window.location.hash = "#/meetings";
                setCurrentView("companion-dashboard");
              } else {
                setCurrentView(newView as any);
              }
            }}
          />
          <Footer
            onOpenBetaModal={handleOpenBetaModal}
            onNavigateToPrivacy={() => { window.location.hash = "#/privacy"; setCurrentView("privacy"); }}
            onNavigateToTerms={() => { window.location.hash = "#/terms"; setCurrentView("terms"); }}
            onNavigateToRefunds={() => { window.location.hash = "#/refunds"; setCurrentView("refunds"); }}
            onNavigateToCookies={() => { window.location.hash = "#/cookies"; setCurrentView("cookies"); }}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
        </>
      )}

      {/* VIEW 8: MAIN LANDING PAGE */}
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

            {/* Access & Pricing */}
            <Pricing onOpenBetaModal={handleOpenBetaModal} />

            {/* FAQ Accordion */}
            <FAQ />
          </main>

          {/* Footer */}
          <Footer
            onOpenBetaModal={handleOpenBetaModal}
            onNavigateToPrivacy={() => { window.location.hash = "#/privacy"; setCurrentView("privacy"); }}
            onNavigateToTerms={() => { window.location.hash = "#/terms"; setCurrentView("terms"); }}
            onNavigateToRefunds={() => { window.location.hash = "#/refunds"; setCurrentView("refunds"); }}
            onNavigateToCookies={() => { window.location.hash = "#/cookies"; setCurrentView("cookies"); }}
            onOpenCookieSettings={() => setIsCookieSettingsModalOpen(true)}
          />
        </>
      )}

      {/* Early Access / Beta Modal */}
      <EarlyAccessModal
        isOpen={isBetaModalOpen}
        onClose={handleCloseBetaModal}
        onNavigateToPrivacy={() => {
          window.location.hash = "#/privacy";
          setCurrentView("privacy");
        }}
      />

      {/* New Meeting Modal */}
      <NewMeetingModal
        isOpen={isNewMeetingModalOpen}
        onClose={() => setIsNewMeetingModalOpen(false)}
        onStartMeeting={handleSelectMeeting}
      />

      {/* Persistent Cookie and Storage Consent Manager */}
      <CookieConsentBanner
        forceOpenModal={isCookieSettingsModalOpen}
        onCloseForceModal={() => setIsCookieSettingsModalOpen(false)}
        onNavigateToCookiePolicy={() => {
          window.location.hash = "#/cookies";
          setCurrentView("cookies");
        }}
      />
    </div>
  );
}