import React, { useState } from "react";
import type { MeetingRecord } from "../../data/meetingCompanionData";
import { getCurrentUser, saveUserMeeting } from "../../lib/userStore";

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMeeting: (meetingId: string) => void;
}

export const NewMeetingModal: React.FC<NewMeetingModalProps> = ({
  isOpen,
  onClose,
  onStartMeeting
}) => {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [status, setStatus] = useState<"completed" | "upcoming">("completed");
  const [primaryLang, setPrimaryLang] = useState("English");
  const [secondaryLang, setSecondaryLang] = useState("Hindi");
  const [initialNotes, setInitialNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim()) return;

    const currentUser = getCurrentUser();
    const newId = `meeting_${Date.now()}`;
    const languages = [primaryLang];
    if (secondaryLang && secondaryLang !== primaryLang) {
      languages.push(secondaryLang);
    }

    const newMeeting: MeetingRecord = {
      id: newId,
      title: meetingTitle.trim(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      duration: "30 mins",
      status,
      primaryLanguages: languages,
      summaryPreview: initialNotes.trim() ? initialNotes.trim().slice(0, 160) : "New meeting record created.",
      fullSummary: initialNotes.trim(),
      participants: [
        {
          id: currentUser.id,
          name: currentUser.name,
          role: "Organizer (You)",
          avatar: currentUser.name.slice(0, 2).toUpperCase(),
          isCurrentUser: true
        }
      ],
      topics: [],
      decisions: [],
      actionItems: [],
      transcript: [],
      initialNotes: initialNotes.trim()
    };

    saveUserMeeting(currentUser.id, newMeeting);
    onStartMeeting(newId);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 100
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 25px 60px -15px rgba(126, 20, 255, 0.25)",
          position: "relative",
          border: "1px solid rgba(126, 20, 255, 0.16)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "#f1f5f9",
            color: "#64748b",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ✕
        </button>

        <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
          Create New Meeting Record
        </h3>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "22px" }}>
          Add your meeting to start taking multilingual notes, extracting action items, or uploading transcripts.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label htmlFor="meeting-title-input" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Meeting Title *
            </label>
            <input
              id="meeting-title-input"
              type="text"
              required
              placeholder="e.g. Weekly Product Strategy Sync"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                outline: "none"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="primary-lang-select" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Primary Language
              </label>
              <select
                id="primary-lang-select"
                value={primaryLang}
                onChange={(e) => setPrimaryLang(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                  background: "#ffffff"
                }}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Spanish">Spanish</option>
                <option value="German">German</option>
                <option value="French">French</option>
              </select>
            </div>

            <div>
              <label htmlFor="secondary-lang-select" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Secondary Language
              </label>
              <select
                id="secondary-lang-select"
                value={secondaryLang}
                onChange={(e) => setSecondaryLang(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                  background: "#ffffff"
                }}
              >
                <option value="None">None (Single Language)</option>
                <option value="Hindi">Hindi</option>
                <option value="Spanish">Spanish</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="English">English</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="meeting-status-select" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Meeting Status
            </label>
            <select
              id="meeting-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as "completed" | "upcoming")}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                background: "#ffffff"
              }}
            >
              <option value="completed">Completed / In Progress</option>
              <option value="upcoming">Upcoming Scheduled Meeting</option>
            </select>
          </div>

          <div>
            <label htmlFor="initial-notes-input" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Initial Notes or Agenda (Optional)
            </label>
            <textarea
              id="initial-notes-input"
              rows={3}
              placeholder="Outline meeting goals, topics, or paste raw notes..."
              value={initialNotes}
              onChange={(e) => setInitialNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ flex: 1, padding: "11px" }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1, padding: "11px" }}
            >
              Create Meeting →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
