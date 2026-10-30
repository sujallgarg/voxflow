import React, { useState } from "react";
import type { MeetingRecord } from "../../data/meetingCompanionData";
import { getCurrentUser, saveUserMeeting } from "../../lib/userStore";
import { useExtensionDetection } from "../../lib/useExtensionDetection";

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMeeting: (meetingId: string) => void;
  onGetExtension?: () => void;
}

export const NewMeetingModal: React.FC<NewMeetingModalProps> = ({
  isOpen,
  onClose,
  onStartMeeting,
  onGetExtension
}) => {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [status, setStatus] = useState<"completed" | "upcoming">("completed");
  const [primaryLang, setPrimaryLang] = useState("English");
  const [secondaryLang, setSecondaryLang] = useState("Hindi");
  const [initialNotes, setInitialNotes] = useState("");

  const { isChecking, isInstalled, isConnected, checkExtension } = useExtensionDetection();

  if (!isOpen) return null;

  const handleGetExtensionClick = () => {
    if (onGetExtension) {
      onGetExtension();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInstalled || !isConnected) return;
    if (!meetingTitle.trim()) return;

    const currentUser = getCurrentUser();
    const newId = `meeting_${Date.now()}`;
    const languages = [primaryLang];
    if (secondaryLang && secondaryLang !== primaryLang && secondaryLang !== "None") {
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
        background: "rgba(0, 0, 0, 0.4)",
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
          maxWidth: "480px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "clamp(20px, 4vw, 28px) clamp(16px, 4vw, 28px)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          position: "relative",
          border: "1px solid #e5e5e5",
          boxSizing: "border-box"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            color: "#111111",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          ✕
        </button>

        {isChecking ? (
          <div style={{ textAlign: "center", padding: "36px 12px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid #e5e5e5",
                borderTopColor: "#111111",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px"
              }}
            />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
              Verifying Extension Status...
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "#666666", margin: 0 }}>
              Checking connection with the VoxFlow Chrome extension.
            </p>
          </div>
        ) : !isInstalled ? (
          /* State 1: Extension Not Installed */
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#f5f5f5",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                marginBottom: "16px"
              }}
            >
              🧩
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
              Chrome Extension Required
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#555555", lineHeight: 1.6, marginBottom: "16px" }}>
              Ready to start a meeting? Install the VoxFlow Chrome extension first. It helps VoxFlow capture the meeting workflow and process your notes.
            </p>

            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "6px",
                padding: "12px 14px",
                fontSize: "0.8125rem",
                color: "#92400e",
                marginBottom: "24px",
                textAlign: "left",
                lineHeight: 1.5
              }}
            >
              <strong>Notice:</strong> VoxFlow’s Chrome extension is required to create or start a meeting. Install the extension to continue.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                id="modal-get-extension-btn"
                className="btn-primary"
                onClick={handleGetExtensionClick}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <span>🧩</span>
                <span>Get Our Extension</span>
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  id="modal-check-again-btn"
                  className="btn-secondary"
                  onClick={() => void checkExtension()}
                  disabled={isChecking}
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", fontSize: "0.8125rem" }}
                >
                  {isChecking ? "Checking..." : "Check Again"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", fontSize: "0.8125rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : !isConnected ? (
          /* State 2: Extension Installed but not Connected / Authenticated */
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#eff6ff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                marginBottom: "16px"
              }}
            >
              🔒
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
              Connect Your Extension
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#555555", lineHeight: 1.6, marginBottom: "16px" }}>
              The VoxFlow Chrome extension is installed, but not connected to your VoxFlow account. Open the extension from your browser toolbar to connect and sync your account.
            </p>

            <div
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                padding: "12px 14px",
                fontSize: "0.8125rem",
                color: "#0369a1",
                marginBottom: "24px",
                textAlign: "left",
                lineHeight: 1.5
              }}
            >
              <strong>Next Step:</strong> Click the VoxFlow extension icon in your browser toolbar to authenticate, then click <em>Check Again</em> to proceed.
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                id="modal-check-again-btn"
                className="btn-primary"
                onClick={() => void checkExtension()}
                disabled={isChecking}
                style={{ flex: 1, padding: "11px", borderRadius: "6px", fontSize: "0.875rem" }}
              >
                {isChecking ? "Checking..." : "Check Again"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                style={{ flex: 1, padding: "11px", borderRadius: "6px", fontSize: "0.875rem" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Extension Installed & Connected -> Full Meeting Creation Form */
          <>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111111", marginBottom: "6px" }}>
              Create Meeting Record
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "#666666", marginBottom: "20px" }}>
              Set up a meeting to capture audio notes, extract action items, and store transcripts.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label htmlFor="meeting-title-input" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
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
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5",
                    fontSize: "0.875rem",
                    outline: "none",
                    background: "#ffffff",
                    color: "#111111"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label htmlFor="primary-lang-select" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
                    Primary Language
                  </label>
                  <select
                    id="primary-lang-select"
                    value={primaryLang}
                    onChange={(e) => setPrimaryLang(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "6px",
                      border: "1px solid #e5e5e5",
                      fontSize: "0.8125rem",
                      background: "#ffffff",
                      color: "#111111",
                      cursor: "pointer"
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
                  <label htmlFor="secondary-lang-select" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
                    Secondary Language
                  </label>
                  <select
                    id="secondary-lang-select"
                    value={secondaryLang}
                    onChange={(e) => setSecondaryLang(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "6px",
                      border: "1px solid #e5e5e5",
                      fontSize: "0.8125rem",
                      background: "#ffffff",
                      color: "#111111",
                      cursor: "pointer"
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
                <label htmlFor="meeting-status-select" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
                  Meeting Status
                </label>
                <select
                  id="meeting-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "completed" | "upcoming")}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5",
                    fontSize: "0.8125rem",
                    background: "#ffffff",
                    color: "#111111",
                    cursor: "pointer"
                  }}
                >
                  <option value="completed">Completed / In Progress</option>
                  <option value="upcoming">Upcoming Scheduled Meeting</option>
                </select>
              </div>

              <div>
                <label htmlFor="initial-notes-input" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
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
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5",
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                    background: "#ffffff",
                    color: "#111111"
                  }}
                />
              </div>

              <div style={{ background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "6px", padding: "10px 12px", fontSize: "0.75rem", color: "#666666", lineHeight: 1.5 }}>
                <strong>Notice:</strong> Ensure you have notified all participants and secured any legally required recording consents prior to capturing audio in your meetings.
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1, padding: "10px", borderRadius: "6px" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: "10px", borderRadius: "6px" }}
                >
                  Create Meeting
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
