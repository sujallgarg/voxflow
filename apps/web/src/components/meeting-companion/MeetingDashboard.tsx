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

  const handleSwitchAccount = (newUserId: string, name: string, email: string) => {
    setCurrentUser({
      id: newUserId,
      name,
      email,
      createdAt: new Date().toISOString()
    });
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
          height: "68px"
        }}
      >
        <div
          className="container"
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* User Account Switcher */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fafafa",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #e5e5e5",
                fontSize: "0.8125rem"
              }}
            >
              <span style={{ color: "#666666" }}>Account:</span>
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
                  fontWeight: 600,
                  color: "#111111",
                  outline: "none",
                  cursor: "pointer",
                  fontSize: "0.8125rem"
                }}
              >
                <option value="user_me">Primary Account ({currentUser.id === "user_me" ? "Active" : "user@voxflow.ai"})</option>
                <option value="user_tester">Test Account 2 ({currentUser.id === "user_tester" ? "Active" : "tester@company.com"})</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={onOpenNewMeetingModal}
              style={{ padding: "8px 16px", fontSize: "0.8125rem", borderRadius: "6px" }}
            >
              + New Meeting
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ paddingTop: "32px" }}>
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
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "8px 16px",
                textAlign: "center",
                minWidth: "90px"
              }}
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.totalMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Total</span>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "8px 16px",
                textAlign: "center",
                minWidth: "90px"
              }}
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.upcomingMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Upcoming</span>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "8px 16px",
                textAlign: "center",
                minWidth: "90px"
              }}
            >
              <span style={{ display: "block", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
                {stats.completedMeetings}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666666" }}>Completed</span>
            </div>
          </div>
        </div>

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
                onClick={onOpenNewMeetingModal}
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
      </main>
    </div>
  );
};
