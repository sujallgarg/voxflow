import React, { useState, useEffect } from "react";
import type { MeetingRecord } from "../../data/meetingCompanionData";
import {
  getCurrentUser,
  getUserMeetings,
  calculateUserStats,
  setCurrentUser,
  deleteUserMeeting,
  syncMeetingsFromBackend,
  type UserProfile
} from "../../lib/userStore";

interface MeetingDashboardProps {
  onSelectMeeting: (
    meetingId: string,
    initialTab?: "overview" | "transcript" | "my-contributions" | "action-items" | "notes"
  ) => void;
  onBackToHome: () => void;
  onOpenNewMeetingModal: () => void;
}

export const MeetingDashboard: React.FC<MeetingDashboardProps> = ({
  onSelectMeeting,
  onBackToHome,
  onOpenNewMeetingModal
}) => {
  const [currentUser, setProfile] = useState<UserProfile>(() => getCurrentUser());
  const [meetings, setMeetings] = useState<MeetingRecord[]>(() => getUserMeetings(getCurrentUser().id));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState("all");
  const [statusTab, setStatusTab] = useState<"all" | "upcoming" | "completed">("all");

  useEffect(() => {
    // Initial sync from backend API
    void syncMeetingsFromBackend(currentUser.id);

    const handleSync = () => {
      const user = getCurrentUser();
      setProfile(user);
      setMeetings(getUserMeetings(user.id));
    };

    window.addEventListener("voxflow_data_changed", handleSync);
    window.addEventListener("voxflow_user_changed", handleSync);

    return () => {
      window.removeEventListener("voxflow_data_changed", handleSync);
      window.removeEventListener("voxflow_user_changed", handleSync);
    };
  }, [currentUser.id]);

  const stats = calculateUserStats(currentUser.id);

  // Filter user's real meetings
  const displayedMeetingsList: MeetingRecord[] = meetings.filter((m) => {
    // Status filter
    if (statusTab !== "all" && m.status !== statusTab) {
      return false;
    }

    // Search filter
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.title.toLowerCase().includes(query) ||
      m.summaryPreview.toLowerCase().includes(query) ||
      m.participants.some((p) => p.name.toLowerCase().includes(query));

    // Language filter
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

  const handleSwitchAccount = (newUserId: string, name: string, email: string) => {
    setCurrentUser({
      id: newUserId,
      name,
      email,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fbf9fe", paddingBottom: "80px" }}>
      {/* Top Header / Breadcrumbs */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid var(--border-subtle)",
          position: "sticky",
          top: 0,
          zIndex: 40
        }}
      >
        <div
          className="container"
          style={{
            height: "70px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.875rem",
                color: "#64748b",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "8px",
                background: "#f8f6fc",
                border: "1px solid #ece5f8",
                cursor: "pointer"
              }}
            >
              ← Back to Main Website
            </button>

            <span style={{ color: "#cbd5e1" }}>/</span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #7e14ff 0%, #a855f7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800
                }}
              >
                V
              </div>
              <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
                Meeting Companion Workspace
              </strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* User Account Indicator & Testing Switcher */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#f8f6fc",
                padding: "4px 10px",
                borderRadius: "10px",
                border: "1px solid #ece5f8",
                fontSize: "0.8rem"
              }}
            >
              <span style={{ color: "#64748b" }}>User:</span>
              <select
                aria-label="Active User Account"
                value={currentUser.id}
                onChange={(e) => {
                  if (e.target.value === "user_me") {
                    handleSwitchAccount("user_me", "My Account", "user@voxflow.ai");
                  } else {
                    handleSwitchAccount("user_tester", "Test Account 2", "tester@company.com");
                  }
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  fontWeight: 700,
                  color: "#7e14ff",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="user_me">Primary Account ({currentUser.id === "user_me" ? "Active" : "user@voxflow.ai"})</option>
                <option value="user_tester">Test Account 2 ({currentUser.id === "user_tester" ? "Active" : "Empty Account"})</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={onOpenNewMeetingModal}
              style={{ padding: "9px 20px", fontSize: "0.875rem" }}
            >
              <span>+ New Meeting</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ paddingTop: "36px" }}>
        {/* Transparent Storage & Privacy Notice */}
        <div
          style={{
            background: "#fbfaff",
            border: "1px solid #e9d5ff",
            borderRadius: "14px",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "28px",
            fontSize: "0.85rem",
            color: "#6b21a8"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>🔒</span>
            <span>
              <strong>User Data Isolation:</strong> Showing records belonging strictly to <strong>{currentUser.email}</strong>. Records are saved in your local browser profile. Backend cloud sync is scheduled for public release.
            </span>
          </div>

          <span
            style={{
              background: "#ede9fe",
              color: "#7e14ff",
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 700
            }}
          >
            Local Workspace
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
            marginBottom: "28px"
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
              Meeting Dashboard
            </h1>
            <p style={{ fontSize: "0.95rem", color: "#64748b" }}>
              Your personal meeting records, multilingual notes, and action items.
            </p>
          </div>

          {/* Quick Metrics - Calculated strictly from user's actual data */}
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "8px 18px",
                textAlign: "center"
              }}
            >
              <span style={{ display: "block", fontSize: "1.35rem", fontWeight: 800, color: "#7e14ff" }}>
                {stats.totalMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Records</span>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "8px 18px",
                textAlign: "center"
              }}
            >
              <span style={{ display: "block", fontSize: "1.35rem", fontWeight: 800, color: "#3b82f6" }}>
                {stats.upcomingMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Upcoming</span>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "8px 18px",
                textAlign: "center"
              }}
            >
              <span style={{ display: "block", fontSize: "1.35rem", fontWeight: 800, color: "#10b981" }}>
                {stats.completedMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Completed</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px"
          }}
        >
          {/* Status Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1edf8",
              padding: "4px",
              borderRadius: "10px",
              gap: "4px"
            }}
          >
            {(["all", "upcoming", "completed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  background: statusTab === tab ? "#ffffff" : "transparent",
                  color: statusTab === tab ? "#7e14ff" : "#64748b",
                  boxShadow: statusTab === tab ? "0 2px 6px rgba(0,0,0,0.05)" : "none",
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
              placeholder="Search meetings by title or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "0.875rem",
                width: "100%",
                maxWidth: "320px",
                outline: "none"
              }}
            />

            <select
              aria-label="Filter by Language"
              value={selectedLanguageFilter}
              onChange={(e) => setSelectedLanguageFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "0.875rem",
                background: "#ffffff",
                color: "#334155"
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
          /* Empty State */
          <div
            style={{
              padding: "72px 24px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px dashed #d8b4fe"
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#f3e8ff",
                color: "#7e14ff",
                fontSize: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto"
              }}
            >
              📋
            </div>

            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
              No meetings yet
            </h3>

            <p style={{ fontSize: "0.9375rem", color: "#64748b", maxWidth: "460px", margin: "0 auto 24px auto", lineHeight: 1.6 }}>
              {searchQuery || selectedLanguageFilter !== "all" || statusTab !== "all"
                ? "No meeting records match your search filters. Try clearing your search parameters."
                : "Your meeting notes, multilingual transcripts, and action items will appear here when you create your first meeting."}
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
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenNewMeetingModal}
                style={{ padding: "12px 28px" }}
              >
                + Create Your First Meeting
              </button>
            )}
          </div>
        ) : (
          /* Meetings Grid */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {displayedMeetingsList.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting.id)}
                className="card-premium"
                style={{
                  background: "#ffffff",
                  padding: "24px 28px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: meeting.status === "completed" ? "#ecfdf5" : "#eff6ff",
                          color: meeting.status === "completed" ? "#059669" : "#2563eb",
                          textTransform: "capitalize"
                        }}
                      >
                        {meeting.status}
                      </span>

                      <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                        {meeting.date} • {meeting.time} ({meeting.duration})
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                      {meeting.title}
                    </h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteMeeting(e, meeting.id, meeting.title)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        color: "#ef4444",
                        background: "#fef2f2",
                        border: "1px solid #fee2e2",
                        cursor: "pointer"
                      }}
                      title="Delete this meeting"
                    >
                      Delete
                    </button>

                    <span style={{ fontSize: "0.875rem", color: "#7e14ff", fontWeight: 600 }}>
                      Open Workspace →
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                  {meeting.summaryPreview || meeting.fullSummary || "No summary recorded yet."}
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingTop: "10px", borderTop: "1px solid #f8f6fc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Languages:</span>
                    {meeting.primaryLanguages.map((lang) => (
                      <span
                        key={lang}
                        style={{
                          fontSize: "0.75rem",
                          background: "#f3e8ff",
                          color: "#7e14ff",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontWeight: 600
                        }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                    {meeting.actionItems.length} Action Items • {meeting.transcript.length} Utterances
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
