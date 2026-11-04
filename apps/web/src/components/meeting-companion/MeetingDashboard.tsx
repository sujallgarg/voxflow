import React, { useState, useEffect } from "react";
import type { MeetingRecord } from "../../data/meetingCompanionData";
import {
  getCurrentUser,
  getUserMeetings,
  getUserTranscriptions,
  calculateUserStats,
  deleteUserMeeting,
  deleteUserTranscription,
  syncMeetingsFromBackend,
  syncTranscriptionsFromBackend,
  type UserProfile,
  type SavedTranscription
} from "../../lib/userStore";
import { UpgradeModal } from "../billing/UpgradeModal";
import { PremiumBadge } from "../billing/PremiumBadge";
import { DashboardUpgradeBanner } from "../billing/DashboardUpgradeBanner";
import { useSubscription } from "../../lib/subscriptionContext";
import { useExtensionDetection } from "../../lib/useExtensionDetection";

interface MeetingDashboardProps {
  onSelectMeeting: (
    meetingId: string,
    initialTab?: "overview" | "transcript" | "my-contributions" | "action-items" | "notes"
  ) => void;
  onBackToHome: () => void;
  onOpenNewMeetingModal: () => void;
  onGetExtension?: () => void;
}

export const MeetingDashboard: React.FC<MeetingDashboardProps> = ({
  onSelectMeeting,
  onBackToHome,
  onOpenNewMeetingModal,
  onGetExtension
}) => {
  const [currentUser, setProfile] = useState<UserProfile>(() => getCurrentUser());
  const [meetings, setMeetings] = useState<MeetingRecord[]>(() => getUserMeetings(getCurrentUser().id));
  const [transcriptions, setTranscriptions] = useState<SavedTranscription[]>(() =>
    getUserTranscriptions(getCurrentUser().id)
  );
  const [mainTab, setMainTab] = useState<"meetings" | "voice-history">("meetings");
  const [copiedVoiceId, setCopiedVoiceId] = useState<string | null>(null);
  const { isChecking, isInstalled, isConnected, checkExtension } = useExtensionDetection();

  const handleGetExtensionClick = () => {
    if (onGetExtension) {
      onGetExtension();
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState("all");
  const [statusTab, setStatusTab] = useState<"all" | "upcoming" | "completed">("all");
  const { entitlements } = useSubscription();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  useEffect(() => {
    void syncMeetingsFromBackend(currentUser.id);
    void syncTranscriptionsFromBackend(currentUser.id);

    const handleSync = () => {
      const user = getCurrentUser();
      setProfile(user);
      setMeetings(getUserMeetings(user.id));
      setTranscriptions(getUserTranscriptions(user.id));
    };

    window.addEventListener("voxflow_data_changed", handleSync);
    window.addEventListener("voxflow_user_changed", handleSync);

    return () => {
      window.removeEventListener("voxflow_data_changed", handleSync);
      window.removeEventListener("voxflow_user_changed", handleSync);
    };
  }, [currentUser.id]);

  const stats = calculateUserStats(currentUser.id);

  const displayedMeetingsList: MeetingRecord[] = meetings.filter((m) => {
    if (statusTab !== "all" && m.status !== statusTab) {
      return false;
    }

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.title.toLowerCase().includes(query) ||
      m.summaryPreview.toLowerCase().includes(query) ||
      m.participants.some((p) => p.name.toLowerCase().includes(query));

    const matchesLang =
      selectedLanguageFilter === "all" ||
      m.primaryLanguages.some((l) => l.toLowerCase() === selectedLanguageFilter.toLowerCase());

    return matchesSearch && matchesLang;
  });

  const handleDeleteMeeting = (e: React.MouseEvent, meetingId: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteUserMeeting(currentUser.id, meetingId);
      setMeetings(getUserMeetings(currentUser.id));
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", paddingBottom: "80px" }}>
      {/* Top Header / Breadcrumbs */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e5e5",
          position: "sticky",
          top: 0,
          zIndex: 40,
          minHeight: "68px",
          padding: "8px 0"
        }}
      >
        <div
          className="container dashboard-header-wrap"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div className="dashboard-header-brand" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onBackToHome}
              style={{
                fontSize: "0.8125rem",
                padding: "6px 12px",
                borderRadius: "6px"
              }}
            >
              ← Back to Website
            </button>

            <span style={{ color: "#d4d4d4" }}>/</span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "5px",
                  background: "#111111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700
                }}
              >
                V
              </div>
              <strong style={{ fontSize: "0.95rem", color: "#111111", fontWeight: 600 }}>
                Meeting Companion
              </strong>
            </div>
          </div>

          <div className="dashboard-header-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* User Account Info */}
            <div
              className="dashboard-account-pill"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fafafa",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #e5e5e5",
                fontSize: "0.8125rem"
              }}
            >
              <span style={{ color: "#666666" }}>Account:</span>
              <span
                style={{
                  fontWeight: 600,
                  color: "#111111",
                  maxWidth: "180px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                title={currentUser.email || currentUser.name}
              >
                {currentUser.name || currentUser.email || "My Account"}
              </span>
            </div>

            {/* Plan Badge */}
            <PremiumBadge size="md" showFree />

            {!isInstalled && (
              <button
                type="button"
                id="dashboard-header-get-extension-btn"
                className="btn-secondary dashboard-header-btn"
                onClick={handleGetExtensionClick}
                style={{
                  padding: "8px 14px",
                  fontSize: "0.8125rem",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span aria-hidden="true">🧩</span>
                <span>Get Our Extension</span>
              </button>
            )}

            <button
              type="button"
              className="btn-primary dashboard-header-btn"
              onClick={() => {
                const meetingsExhausted =
                  (entitlements?.meetings?.isExhausted) ||
                  (entitlements?.usage && entitlements.usage.meetingsUsed >= (entitlements.limits?.monthlyMeetings || 3));

                if (meetingsExhausted) {
                  setIsUpgradeModalOpen(true);
                } else {
                  onOpenNewMeetingModal();
                }
              }}
              style={{ padding: "8px 16px", fontSize: "0.8125rem", borderRadius: "6px" }}
            >
              + New Meeting
            </button>
          </div>
        </div>
      </header>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        reason="You have reached your monthly meeting allowance. Upgrade to Premium ($9/mo) or renew early to continue recording and analyzing meetings without interruption."
        limitReached={`${entitlements?.breakdown?.meetings.limit ?? entitlements?.limits?.monthlyMeetings ?? (entitlements?.isPremium ? 25 : 3)} meetings / month`}
        featureKey="meetings"
      />

      {/* Main Container */}
      <main className="container" style={{ paddingTop: "24px" }}>
        {/* Dashboard Pro Upgrade Banner (Non-intrusive) */}
        <DashboardUpgradeBanner
          entitlements={entitlements}
          onExplorePro={() => {
            window.location.hash = "#pricing";
          }}
        />

        {/* Storage Notice */}
        <div
          style={{
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "6px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "24px",
            fontSize: "0.8125rem",
            color: "#666666"
          }}
        >
          <div>
            Showing meeting records for <strong>{currentUser.email}</strong>. Audio transcripts and action items are saved locally in your browser session.
          </div>

          <span
            style={{
              background: "#ffffff",
              color: "#111111",
              border: "1px solid #e5e5e5",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 600
            }}
          >
            Local Session
          </span>
        </div>

        {/* Dashboard Title & Stats Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "24px"
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 700, color: "#111111", marginBottom: "4px" }}>
              Meeting Dashboard
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0 }}>
              Review meeting notes, action items, and multilingual transcripts.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="dashboard-stats-grid">
            <div
              className="dashboard-stat-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "10px 16px",
                textAlign: "center"
              }}
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.totalMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Total</span>
            </div>

            <div
              className="dashboard-stat-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "10px 16px",
                textAlign: "center"
              }}
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.upcomingMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Upcoming</span>
            </div>

            <div
              className="dashboard-stat-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "10px 16px",
                textAlign: "center"
              }}
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.completedMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Completed</span>
            </div>

            <div
              className="dashboard-stat-card"
              onClick={() => setMainTab("voice-history")}
              style={{
                background: mainTab === "voice-history" ? "#f5f5f5" : "#ffffff",
                border: mainTab === "voice-history" ? "1px solid #111111" : "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "10px 16px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              title="Click to view saved voice input dictations"
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.totalTranscriptions}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Voice Notes</span>
            </div>
          </div>
        </div>

        {/* Extension Prerequisite Banner */}
        {!isChecking && !isInstalled && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "260px", flex: 1 }}>
              <span style={{ fontSize: "1.5rem" }} aria-hidden="true">🧩</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#92400e", marginBottom: "2px" }}>
                  VoxFlow Chrome Extension Required
                </div>
                <div style={{ fontSize: "0.8125rem", color: "#78350f", lineHeight: 1.5 }}>
                  VoxFlow’s Chrome extension is required to create or start a meeting. Install the extension to continue.
                </div>
              </div>
            </div>
            <div className="dashboard-banner-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                id="dashboard-banner-get-extension-btn"
                className="btn-primary"
                onClick={handleGetExtensionClick}
                style={{ padding: "8px 16px", fontSize: "0.8125rem", borderRadius: "6px" }}
              >
                Get Our Extension
              </button>
              <button
                type="button"
                id="dashboard-banner-check-again-btn"
                className="btn-secondary"
                onClick={() => void checkExtension()}
                disabled={isChecking}
                style={{ padding: "8px 14px", fontSize: "0.8125rem", borderRadius: "6px" }}
              >
                {isChecking ? "Checking..." : "Check Again"}
              </button>
            </div>
          </div>
        )}

        {!isChecking && isInstalled && !isConnected && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "260px", flex: 1 }}>
              <span style={{ fontSize: "1.5rem" }} aria-hidden="true">🔒</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e40af", marginBottom: "2px" }}>
                  Connect Your Chrome Extension
                </div>
                <div style={{ fontSize: "0.8125rem", color: "#1e3a8a", lineHeight: 1.5 }}>
                  VoxFlow Chrome extension is installed, but not connected to your account. Open the extension to sync.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                id="dashboard-banner-check-again-btn"
                className="btn-primary"
                onClick={() => void checkExtension()}
                disabled={isChecking}
                style={{ padding: "8px 16px", fontSize: "0.8125rem", borderRadius: "6px" }}
              >
                {isChecking ? "Checking..." : "Check Again"}
              </button>
            </div>
          </div>
        )}

        {/* Primary View Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #e5e5e5",
            marginBottom: "20px"
          }}
        >
          <button
            type="button"
            onClick={() => setMainTab("meetings")}
            style={{
              padding: "10px 18px",
              fontSize: "0.875rem",
              fontWeight: mainTab === "meetings" ? 600 : 500,
              color: mainTab === "meetings" ? "#111111" : "#666666",
              borderBottom: mainTab === "meetings" ? "2px solid #111111" : "2px solid transparent",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              marginBottom: "-1px"
            }}
          >
            Meetings ({meetings.length})
          </button>
          <button
            type="button"
            onClick={() => setMainTab("voice-history")}
            style={{
              padding: "10px 18px",
              fontSize: "0.875rem",
              fontWeight: mainTab === "voice-history" ? 600 : 500,
              color: mainTab === "voice-history" ? "#111111" : "#666666",
              borderBottom: mainTab === "voice-history" ? "2px solid #111111" : "2px solid transparent",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              marginBottom: "-1px"
            }}
          >
            Voice History ({transcriptions.length})
          </button>
        </div>

        {mainTab === "meetings" ? (
          <>
            {/* Filter & Search Bar */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "6px",
            border: "1px solid #e5e5e5",
            padding: "14px 16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          {/* Status Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "#f5f5f5",
              padding: "3px",
              borderRadius: "6px",
              gap: "4px",
              border: "1px solid #e5e5e5"
            }}
          >
            {(["all", "upcoming", "completed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  background: statusTab === tab ? "#111111" : "transparent",
                  color: statusTab === tab ? "#ffffff" : "#666666",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "capitalize"
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box & Language Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
            <input
              type="text"
              placeholder="Search meetings by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid #e5e5e5",
                fontSize: "0.8125rem",
                width: "100%",
                maxWidth: "280px",
                outline: "none",
                background: "#ffffff",
                color: "#111111"
              }}
            />

            <select
              aria-label="Filter by Language"
              value={selectedLanguageFilter}
              onChange={(e) => setSelectedLanguageFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid #e5e5e5",
                fontSize: "0.8125rem",
                background: "#ffffff",
                color: "#111111",
                cursor: "pointer"
              }}
            >
              <option value="all">All Languages</option>
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="spanish">Spanish</option>
              <option value="german">German</option>
              <option value="french">French</option>
            </select>
          </div>
        </div>

        {/* Content Body: Empty State or Meeting Cards */}
        {displayedMeetingsList.length === 0 ? (
          <div
            style={{
              padding: "56px 20px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px dashed #e5e5e5"
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
              No meetings found
            </h3>

            <p style={{ fontSize: "0.875rem", color: "#666666", maxWidth: "420px", margin: "0 auto 20px auto", lineHeight: 1.6 }}>
              {searchQuery || selectedLanguageFilter !== "all" || statusTab !== "all"
                ? "No meeting records match your search parameters. Try clearing your filters."
                : "Your meeting notes, transcripts, and action items will appear here."}
            </p>

            {searchQuery || selectedLanguageFilter !== "all" || statusTab !== "all" ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedLanguageFilter("all");
                  setStatusTab("all");
                }}
                style={{ padding: "8px 16px", fontSize: "0.8125rem" }}
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const meetingsExhausted =
                    (entitlements?.meetings?.isExhausted) ||
                    (entitlements?.usage && entitlements.usage.meetingsUsed >= (entitlements.limits?.monthlyMeetings || 3));

                  if (meetingsExhausted) {
                    setIsUpgradeModalOpen(true);
                  } else {
                    onOpenNewMeetingModal();
                  }
                }}
                style={{ padding: "10px 20px", fontSize: "0.875rem" }}
              >
                Create New Meeting
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {displayedMeetingsList.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting.id)}
                className="card-premium"
                style={{
                  background: "#ffffff",
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid #e5e5e5",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#f5f5f5",
                          color: "#111111",
                          border: "1px solid #e5e5e5",
                          textTransform: "capitalize"
                        }}
                      >
                        {meeting.status}
                      </span>

                      <span style={{ fontSize: "0.8125rem", color: "#666666" }}>
                        {meeting.date} • {meeting.time} ({meeting.duration})
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#111111", margin: 0 }}>
                      {meeting.title}
                    </h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteMeeting(e, meeting.id, meeting.title)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        color: "#666666",
                        background: "#ffffff",
                        border: "1px solid #e5e5e5",
                        cursor: "pointer"
                      }}
                      title="Delete this meeting"
                    >
                      Delete
                    </button>

                    <span style={{ fontSize: "0.8125rem", color: "#111111", fontWeight: 600 }}>
                      Open Workspace →
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.6, margin: 0 }}>
                  {meeting.summaryPreview || meeting.fullSummary || "No summary recorded yet."}
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingTop: "10px", borderTop: "1px solid #f5f5f5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "0.75rem", color: "#666666" }}>Languages:</span>
                    {meeting.primaryLanguages.map((lang) => (
                      <span
                        key={lang}
                        style={{
                          fontSize: "0.75rem",
                          background: "#fafafa",
                          color: "#111111",
                          border: "1px solid #e5e5e5",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          fontWeight: 500
                        }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "#666666" }}>
                    {meeting.actionItems.length} Tasks • {meeting.transcript.length} Utterances
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    ) : (
          /* Main Tab 2: Voice Input History */
          <div>
            <div
              style={{
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "12px 16px",
                marginBottom: "20px",
                fontSize: "0.8125rem",
                color: "#666666",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <div>
                Durable voice input history synchronized across your Chrome extension and web account.
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => syncTranscriptionsFromBackend(currentUser.id)}
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                ↻ Refresh History
              </button>
            </div>

            {transcriptions.length === 0 ? (
              <div
                style={{
                  padding: "56px 20px",
                  textAlign: "center",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px dashed #e5e5e5"
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎙️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
                  No voice dictations yet
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#666666", maxWidth: "440px", margin: "0 auto", lineHeight: 1.6 }}>
                  Dictate anywhere in your browser using the VoxFlow Chrome extension. Your original spoken transcripts and transformed text will automatically synchronize and appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                {transcriptions.map((item) => (
                  <div
                    key={item.id}
                    className="card-premium"
                    style={{
                      padding: "20px 24px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e5e5e5",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.1rem" }}>🎙️</span>
                        <div>
                          <strong style={{ fontSize: "0.95rem", color: "#111111" }}>
                            {item.title || "Voice Dictation"}
                          </strong>
                          <div style={{ fontSize: "0.75rem", color: "#666666" }}>
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            background: "#f5f5f5",
                            color: "#111111",
                            border: "1px solid #e5e5e5",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 500
                          }}
                        >
                          {item.language || "Auto"}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Delete this voice dictation record?")) {
                              deleteUserTranscription(currentUser.id, item.id);
                              setTranscriptions(getUserTranscriptions(currentUser.id));
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            color: "#991b1b",
                            background: "transparent",
                            border: "1px solid #fecaca",
                            cursor: "pointer"
                          }}
                          title="Delete voice record"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Transformed Final Text */}
                    {item.transformedText && (
                      <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: "6px", border: "1px solid #e5e5e5" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666666", textTransform: "uppercase" }}>
                            Final Processed Text
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(item.transformedText || "");
                                setCopiedVoiceId(`final_${item.id}`);
                                setTimeout(() => setCopiedVoiceId(null), 2000);
                              } catch (e) {
                                console.warn("Clipboard copy failed:", e);
                              }
                            }}
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: copiedVoiceId === `final_${item.id}` ? "#166534" : "#111111",
                              background: copiedVoiceId === `final_${item.id}` ? "#f0fdf4" : "#ffffff",
                              border: copiedVoiceId === `final_${item.id}` ? "1px solid #bbf7d0" : "1px solid #e5e5e5",
                              borderRadius: "4px",
                              padding: "3px 8px",
                              cursor: "pointer"
                            }}
                          >
                            {copiedVoiceId === `final_${item.id}` ? "✓ Copied" : "Copy Processed Text"}
                          </button>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "#111111", lineHeight: 1.6, margin: 0 }}>
                          {item.transformedText}
                        </p>
                      </div>
                    )}

                    {/* Original Transcript */}
                    {item.transcript && item.transcript !== item.transformedText && (
                      <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "6px", border: "1px dashed #e5e5e5" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#666666" }}>
                            Original Spoken Transcript
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(item.transcript || "");
                                setCopiedVoiceId(`orig_${item.id}`);
                                setTimeout(() => setCopiedVoiceId(null), 2000);
                              } catch (e) {
                                console.warn("Clipboard copy failed:", e);
                              }
                            }}
                            style={{
                              fontSize: "0.75rem",
                              color: copiedVoiceId === `orig_${item.id}` ? "#166534" : "#666666",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              textDecoration: "underline"
                            }}
                          >
                            {copiedVoiceId === `orig_${item.id}` ? "✓ Copied" : "Copy Original"}
                          </button>
                        </div>
                        <p style={{ fontSize: "0.8125rem", color: "#666666", fontStyle: "italic", margin: 0 }}>
                          "{item.transcript}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
