import { useState, useEffect, lazy, Suspense } from "react";
import "./index.css";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { HowItWorks } from "./components/HowItWorks";
import { MeetingCompanionLanding } from "./components/meeting-companion/MeetingCompanionLanding";
import { InteractiveDemo } from "./components/InteractiveDemo";
import { BeforeAfter } from "./components/BeforeAfter";
import { FinalCTA } from "./components/FinalCTA";
import { Pricing } from "./components/Pricing";
import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { getCurrentUser, getUserMeetings, saveUserMeeting, setCurrentUser as setStoredUser } from "./lib/userStore";
import { api } from "./lib/api";
import type { MeetingRecord } from "./data/meetingCompanionData";
import { CookieConsentBanner } from "./components/legal/CookieConsentBanner";
import { useAuth } from "./lib/authContext";
import { useSubscription } from "./lib/subscriptionContext";
import { openExtensionStore } from "./lib/extensionConfig";

// Code-split heavy dashboard, auth, modal, widget and policy components for faster initial load
const FloatingWebWidget = lazy(() => import("./components/FloatingWebWidget").then(m => ({ default: m.FloatingWebWidget })));
const MeetingDashboard = lazy(() => import("./components/meeting-companion/MeetingDashboard").then(m => ({ default: m.MeetingDashboard })));
const MeetingWorkspace = lazy(() => import("./components/meeting-companion/MeetingWorkspace").then(m => ({ default: m.MeetingWorkspace })));
const NewMeetingModal = lazy(() => import("./components/meeting-companion/NewMeetingModal").then(m => ({ default: m.NewMeetingModal })));
const BillingDashboard = lazy(() => import("./components/billing/BillingDashboard").then(m => ({ default: m.BillingDashboard })));
const CheckoutSuccessPage = lazy(() => import("./components/billing/CheckoutStatus").then(m => ({ default: m.CheckoutSuccessPage })));
const CheckoutCancelPage = lazy(() => import("./components/billing/CheckoutStatus").then(m => ({ default: m.CheckoutCancelPage })));
const AuthPages = lazy(() => import("./components/auth/AuthPages").then(m => ({ default: m.AuthPages })));
const PrivacyPolicy = lazy(() => import("./components/legal/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./components/legal/TermsOfService").then(m => ({ default: m.TermsOfService })));
const RefundPolicy = lazy(() => import("./components/legal/RefundPolicy").then(m => ({ default: m.RefundPolicy })));
const CookiePolicy = lazy(() => import("./components/legal/CookiePolicy").then(m => ({ default: m.CookiePolicy })));
const EarlyAccessModal = lazy(() => import("./components/EarlyAccessModal").then(m => ({ default: m.EarlyAccessModal })));
const ExtensionNoticeModal = lazy(() => import("./components/extension/ExtensionNoticeModal").then(m => ({ default: m.ExtensionNoticeModal })));
const UpgradeReminderModal = lazy(() => import("./components/billing/UpgradeReminderModal").then(m => ({ default: m.UpgradeReminderModal })));

import {
  canShowAutomaticPopup,
  checkUsageThresholdReminder,
  getOccasionalReminderConfig,
  getMeetingCompletionReminderConfig,
  type ReminderConfig
} from "./lib/upgradeReminders";

export default function App() {
  type AppView =
    | "landing"
    | "companion-dashboard"
    | "companion-workspace"
    | "billing"
    | "billing-success"
    | "billing-cancel"
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
  const [isExtensionNoticeOpen, setIsExtensionNoticeOpen] = useState(false);
  const [isCookieSettingsModalOpen, setIsCookieSettingsModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [userMeetings, setUserMeetings] = useState<MeetingRecord[]>(() =>
    getUserMeetings(getCurrentUser().id)
  );
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);
  const [meetingLoadError, setMeetingLoadError] = useState<string | null>(null);

  const { user, loading, isConfigured } = useAuth();
  const { entitlements, isPremium } = useSubscription();

  // Smart Upgrade Reminders State
  const [activeReminder, setActiveReminder] = useState<ReminderConfig | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

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

  // Sync hash routing if user enters #/meetings, #/billing, #/login, #/signup, etc.
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || "";
      if (hash.startsWith("#/meetings/")) {
        const id = hash.replace("#/meetings/", "");
        setSelectedMeetingId(id);
        setCurrentView("companion-workspace");
      } else if (hash === "#/meetings") {
        setCurrentView("companion-dashboard");
      } else if (hash.startsWith("#/billing/success")) {
        setCurrentView("billing-success");
      } else if (hash.startsWith("#/billing/cancel")) {
        setCurrentView("billing-cancel");
      } else if (hash === "#/billing") {
        setCurrentView("billing");
      } else if (hash === "#/pricing" || hash === "#pricing") {
        setCurrentView("landing");
        setTimeout(() => {
          document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
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
    const isBillingRoute = currentView === "billing";

    // If Supabase is configured and user is unauthenticated on protected route:
    if (isConfigured && !user && (isMeetingRoute || isBillingRoute)) {
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

  // Smart Upgrade Reminder Trigger Listeners
  useEffect(() => {
    const isExcludedView =
      currentView === "login" ||
      currentView === "signup" ||
      currentView === "forgot-password" ||
      currentView === "reset-password" ||
      currentView === "verify" ||
      currentView === "billing-success" ||
      currentView === "billing-cancel";

    if (isPremium || isExcludedView) return;

    // Trigger A: Meaningful action (voice transcription completed)
    const handleMeaningfulAction = () => {
      if (!canShowAutomaticPopup(isPremium, false)) return;

      const thresholdReminder = checkUsageThresholdReminder(entitlements);
      const reminderToUse = thresholdReminder || getOccasionalReminderConfig();

      setTimeout(() => {
        if (!isPremium && !isExcludedView) {
          setActiveReminder(reminderToUse);
          setIsReminderOpen(true);
        }
      }, 1500);
    };

    // Trigger B: Meeting notes / AI summary completion
    const handleMeetingCompleted = () => {
      if (!canShowAutomaticPopup(isPremium, false)) return;

      const thresholdReminder = checkUsageThresholdReminder(entitlements);
      const reminderToUse = thresholdReminder || getMeetingCompletionReminderConfig();

      setTimeout(() => {
        if (!isPremium && !isExcludedView) {
          setActiveReminder(reminderToUse);
          setIsReminderOpen(true);
        }
      }, 1500);
    };

    // Trigger C: Gentle session active usage timer (after 3 minutes of active visit)
    const activeSessionTimer = setTimeout(() => {
      if (canShowAutomaticPopup(isPremium, false) && !isExcludedView) {
        const thresholdReminder = checkUsageThresholdReminder(entitlements);
        setActiveReminder(thresholdReminder || getOccasionalReminderConfig());
        setIsReminderOpen(true);
      }
    }, 180000);

    window.addEventListener("voxflow_meaningful_action", handleMeaningfulAction);
    window.addEventListener("voxflow_meeting_completed", handleMeetingCompleted);

    return () => {
      clearTimeout(activeSessionTimer);
      window.removeEventListener("voxflow_meaningful_action", handleMeaningfulAction);
      window.removeEventListener("voxflow_meeting_completed", handleMeetingCompleted);
    };
  }, [isPremium, currentView, entitlements]);

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
              saveUserMeeting(currentUser.id, res.meeting, false);
              setUserMeetings(getUserMeetings(currentUser.id));
              setMeetingLoadError(null);
            } else {
              setMeetingLoadError("Meeting not found on server.");
            }
          })
          .catch((err: any) => {
            console.warn("Direct meeting fetch notice:", err);
            const msg = err?.message || "";
            if (msg.includes("404") || msg.includes("not found")) {
              setMeetingLoadError(
                "Meeting record not found or does not belong to this account."
              );
            } else if (msg.includes("401") || msg.includes("403")) {
              setMeetingLoadError("You are not authorized to view this meeting.");
            } else {
              setMeetingLoadError(
                "Could not connect to the VoxFlow server. Please check your network connection and retry."
              );
            }
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

  const handleGetExtension = () => {
    openExtensionStore(() => {
      setIsExtensionNoticeOpen(true);
    });
  };

  const activeMeetingRecord: MeetingRecord | undefined = userMeetings.find(
    (m) => m.id === selectedMeetingId
  );

  const isDirectMeetingLoading =
    currentView === "companion-workspace" &&
    Boolean(selectedMeetingId) &&
    !activeMeetingRecord &&
    !meetingLoadError;

  return (
    <div className="voxflow-app" style={{ minHeight: "100vh", position: "relative" }}>
      {/* Subtle ambient background glow */}
      <div className="ambient-bg" aria-hidden="true" />

      {/* NON-LANDING SUB-VIEWS (Lazy Loaded for maximum site speed) */}
      <Suspense fallback={<div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: "14px" }}>Loading...</div>}>
        {/* VIEW 1: MEETING DASHBOARD */}
        {currentView === "companion-dashboard" && (
          <MeetingDashboard
            onSelectMeeting={handleSelectMeeting}
            onBackToHome={handleBackToHome}
            onOpenNewMeetingModal={() => setIsNewMeetingModalOpen(true)}
            onGetExtension={handleGetExtension}
          />
        )}

      {/* VIEW 2: MEETING WORKSPACE */}
      {currentView === "companion-workspace" && (
        (isLoadingMeeting || isDirectMeetingLoading) ? (
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
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                {meetingLoadError && meetingLoadError.includes("network") && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setMeetingLoadError(null);
                      setIsLoadingMeeting(true);
                      api.getMeeting(selectedMeetingId, currentUser.id)
                        .then((res) => {
                          if (res?.meeting) {
                            saveUserMeeting(currentUser.id, res.meeting, false);
                            setUserMeetings(getUserMeetings(currentUser.id));
                          }
                        })
                        .catch(() => {})
                        .finally(() => setIsLoadingMeeting(false));
                    }}
                    style={{ fontSize: "0.875rem", padding: "9px 18px" }}
                  >
                    Retry Loading
                  </button>
                )}
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
          </div>
        )
      )}

      {/* VIEW: BILLING DASHBOARD */}
      {currentView === "billing" && (
        <BillingDashboard
          onBackToHome={handleBackToHome}
          onNavigateToPricing={() => {
            window.location.hash = "#pricing";
          }}
        />
      )}

      {/* VIEW: CHECKOUT SUCCESS */}
      {currentView === "billing-success" && (
        <CheckoutSuccessPage
          onBackToApp={() => {
            window.location.hash = "#/meetings";
            setCurrentView("companion-dashboard");
          }}
          onNavigateToBilling={() => {
            window.location.hash = "#/billing";
            setCurrentView("billing");
          }}
        />
      )}

      {/* VIEW: CHECKOUT CANCEL */}
      {currentView === "billing-cancel" && (
        <CheckoutCancelPage
          onBackToApp={() => {
            window.location.hash = "#/meetings";
            setCurrentView("companion-dashboard");
          }}
          onNavigateToPricing={() => {
            window.location.hash = "#pricing";
          }}
        />
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
      </Suspense>

      {/* VIEW 8: MAIN LANDING PAGE */}
      {currentView === "landing" && (
        <>
          {/* 1. Navigation */}
          <Navbar onOpenBetaModal={handleOpenBetaModal} />

          {/* Main Content */}
          <main id="main-content">
            {/* 2. Hero Section */}
            <Hero
              onOpenBetaModal={handleOpenBetaModal}
              onScrollToDemo={handleScrollToDemo}
              onGetExtension={handleGetExtension}
            />

            {/* 3. Interactive Voice Demo */}
            <InteractiveDemo />

            {/* 4. Before-and-After Example */}
            <BeforeAfter />

            {/* 5. How VoxFlow Works */}
            <HowItWorks />

            {/* 6. Core Features */}
            <Features />

            {/* 7. Meetings and AI Summaries */}
            <MeetingCompanionLanding />

            {/* 8. Pricing */}
            <Pricing onOpenBetaModal={handleOpenBetaModal} />

            {/* 9. FAQ */}
            <FAQ />

            {/* 10. Final Call to Action */}
            <FinalCTA onOpenBetaModal={handleOpenBetaModal} />
          </main>

          {/* 11. Footer */}
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

      {/* Modals wrapped in Suspense for zero initial load penalty */}
      <Suspense fallback={null}>
        {/* Early Access / Beta Modal */}
        <EarlyAccessModal
          isOpen={isBetaModalOpen}
          onClose={handleCloseBetaModal}
          onNavigateToPrivacy={() => {
            window.location.hash = "#/privacy";
            setCurrentView("privacy");
          }}
        />

        {/* Chrome Extension Store Notice Modal (fallback when listing pending) */}
        <ExtensionNoticeModal
          isOpen={isExtensionNoticeOpen}
          onClose={() => setIsExtensionNoticeOpen(false)}
          onOpenEarlyAccess={handleOpenBetaModal}
        />

        {/* New Meeting Modal */}
        <NewMeetingModal
          isOpen={isNewMeetingModalOpen}
          onClose={() => setIsNewMeetingModalOpen(false)}
          onStartMeeting={handleSelectMeeting}
          onGetExtension={handleGetExtension}
        />

        {/* Smart Premium Upgrade Reminder Modal */}
        <UpgradeReminderModal
          isOpen={isReminderOpen}
          config={activeReminder}
          onClose={() => setIsReminderOpen(false)}
          onExplorePro={() => {
            if (currentView !== "landing") {
              window.location.hash = "#pricing";
              setCurrentView("landing");
            }
            setTimeout(() => {
              document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
            }, 150);
          }}
        />
      </Suspense>

      {/* Persistent Cookie and Storage Consent Manager */}
      <CookieConsentBanner
        forceOpenModal={isCookieSettingsModalOpen}
        onCloseForceModal={() => setIsCookieSettingsModalOpen(false)}
        onNavigateToCookiePolicy={() => {
          window.location.hash = "#/cookies";
          setCurrentView("cookies");
        }}
      />

      {/* Unified Authoritative VoxFlow Floating Website Widget */}
      <Suspense fallback={null}>
        <FloatingWebWidget />
      </Suspense>
    </div>
  );
}