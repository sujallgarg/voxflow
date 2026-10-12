import React, { useState } from "react";
import type {
  MeetingRecord,
  ActionItem,
  DecisionItem
} from "../../data/meetingCompanionData";
import { getCurrentUser, saveUserMeeting } from "../../lib/userStore";
import { api } from "../../lib/api";

export type WorkspaceTabType = "overview" | "transcript" | "action-items" | "notes";

interface MeetingWorkspaceProps {
  meeting: MeetingRecord;
  initialTab?: WorkspaceTabType;
  onBackToDashboard: () => void;
  onUpdateMeeting?: (updated: MeetingRecord) => void;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

function getCurrentTimeString(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export const MeetingWorkspace: React.FC<MeetingWorkspaceProps> = ({
  meeting: initialMeeting,
  initialTab = "overview",
  onBackToDashboard,
  onUpdateMeeting
}) => {
  const currentUser = getCurrentUser();
  const [meeting, setMeeting] = useState<MeetingRecord>(initialMeeting);
  const [activeTab, setActiveTab] = useState<WorkspaceTabType>(initialTab);

  // Notes state
  const [notesContent, setNotesContent] = useState<string>(
    meeting.initialNotes || meeting.fullSummary || ""
  );
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // AI Notes Generation state
  const [isGeneratingNotes, setIsGeneratingNotes] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // New action item form state
  const [newActionTask, setNewActionTask] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState(currentUser.name);
  const [newActionDueDate, setNewActionDueDate] = useState("End of week");

  // Transcript input state
  const [newTranscriptSpeaker, setNewTranscriptSpeaker] = useState(currentUser.name);
  const [newTranscriptText, setNewTranscriptText] = useState("");

  const persistMeeting = (updated: MeetingRecord) => {
    setMeeting(updated);
    saveUserMeeting(currentUser.id, updated);
    if (onUpdateMeeting) onUpdateMeeting(updated);
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    const updated: MeetingRecord = {
      ...meeting,
      initialNotes: notesContent,
      fullSummary: meeting.fullSummary || notesContent.slice(0, 300),
      summaryPreview: notesContent.slice(0, 160)
    };
    persistMeeting(updated);
    setIsSavingNotes(false);
    setSaveSuccessMsg("Notes saved successfully!");
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  const handleCopyNotes = async () => {
    try {
      await navigator.clipboard.writeText(notesContent);
      setSaveSuccessMsg("Copied notes to clipboard!");
      setTimeout(() => setSaveSuccessMsg(null), 2000);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  const handleDownloadNotes = () => {
    const element = document.createElement("a");
    const file = new Blob([notesContent], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-notes.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Real AI synthesis using backend /meeting-notes API
  const handleGenerateAiNotes = async () => {
    const textSource =
      notesContent.trim() ||
      meeting.transcript.map((t) => `${t.speakerName}: ${t.originalText}`).join("\n");

    if (!textSource) {
      setAiError("Please add meeting notes or transcript utterances first to generate AI summaries.");
      return;
    }

    try {
      setIsGeneratingNotes(true);
      setAiError(null);

      const result = await api.generateMeetingNotes(textSource, meeting.title);

      const newDecisions: DecisionItem[] = result.decisions.map((d, i) => ({
        id: `d_${Date.now()}_${i}`,
        decision: d.decision,
        context: d.context
      }));

      const newActionItems: ActionItem[] = result.actionItems.map((a, i) => ({
        id: `a_${Date.now()}_${i}`,
        task: a.task,
        assignee: a.assignee || currentUser.name,
        dueDate: a.dueDate || "Follow-up",
        completed: a.completed || false
      }));

      const updated: MeetingRecord = {
        ...meeting,
        fullSummary: result.summary,
        summaryPreview: result.summary.slice(0, 160),
        decisions: [...meeting.decisions, ...newDecisions],
        actionItems: [...meeting.actionItems, ...newActionItems],
        topics: result.topics.map((t, i) => ({
          id: `t_${Date.now()}_${i}`,
          title: t.title,
          timeRange: "Session",
          summary: t.summary
        }))
      };

      persistMeeting(updated);
      setSaveSuccessMsg("AI analysis complete! Summary, decisions, and action items updated.");
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("AI meeting notes error:", err);
      setAiError(err.message || "Failed to generate meeting notes via backend API. Ensure VoxFlow API is running.");
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleToggleAction = (id: string) => {
    const updatedActions = meeting.actionItems.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    persistMeeting({ ...meeting, actionItems: updatedActions });
  };

  const handleDeleteAction = (id: string) => {
    const updatedActions = meeting.actionItems.filter((item) => item.id !== id);
    persistMeeting({ ...meeting, actionItems: updatedActions });
  };

  const handleAddActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTask.trim()) return;

    const newItem: ActionItem = {
      id: generateId("act"),
      task: newActionTask.trim(),
      assignee: newActionAssignee.trim() || currentUser.name,
      dueDate: newActionDueDate.trim() || "Pending",
      completed: false
    };

    persistMeeting({ ...meeting, actionItems: [...meeting.actionItems, newItem] });
    setNewActionTask("");
  };

  const handleAddUtterance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTranscriptText.trim()) return;

    const newUtterance = {
      id: generateId("utt"),
      speakerId: currentUser.id,
      speakerName: newTranscriptSpeaker.trim() || currentUser.name,
      speakerRole: "Participant",
      isCurrentUser: true,
      timestamp: getCurrentTimeString(),
      originalLanguage: meeting.primaryLanguages[0] || "English",
      originalText: newTranscriptText.trim(),
      translations: {}
    };

    persistMeeting({ ...meeting, transcript: [...meeting.transcript, newUtterance] });
    setNewTranscriptText("");
  };

  const handleDeleteUtterance = (id: string) => {
    const updated = meeting.transcript.filter((t) => t.id !== id);
    persistMeeting({ ...meeting, transcript: updated });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fbf9fe", paddingBottom: "80px" }}>
      {/* Top Header */}
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
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={onBackToDashboard}
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
              ← Back to Meetings
            </button>

            <span style={{ color: "#cbd5e1" }}>/</span>

            <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>
              {meeting.title}
            </strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                background: meeting.status === "completed" ? "#ecfdf5" : "#eff6ff",
                color: meeting.status === "completed" ? "#059669" : "#2563eb",
                textTransform: "capitalize"
              }}
            >
              {meeting.status}
            </span>

            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerateAiNotes}
              disabled={isGeneratingNotes}
              style={{ padding: "8px 18px", fontSize: "0.85rem" }}
            >
              {isGeneratingNotes ? "Analyzing Speech..." : "✨ Run AI Summary"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="container" style={{ paddingTop: "28px" }}>
        {/* Success / Error Toast Notifications */}
        {saveSuccessMsg && (
          <div
            style={{
              padding: "12px 18px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              borderRadius: "12px",
              marginBottom: "20px",
              fontSize: "0.875rem",
              fontWeight: 600
            }}
          >
            ✓ {saveSuccessMsg}
          </div>
        )}

        {aiError && (
          <div
            style={{
              padding: "12px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: "12px",
              marginBottom: "20px",
              fontSize: "0.875rem",
              fontWeight: 600
            }}
          >
            ⚠️ {aiError}
          </div>
        )}

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "28px",
            paddingBottom: "4px"
          }}
        >
          {(
            [
              { id: "overview", label: "Overview & Decisions" },
              { id: "transcript", label: `Transcript (${meeting.transcript.length})` },
              { id: "action-items", label: `Action Items (${meeting.actionItems.length})` },
              { id: "notes", label: "Notes & Agenda" }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as WorkspaceTabType)}
              style={{
                padding: "10px 18px",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: activeTab === tab.id ? "#7e14ff" : "#64748b",
                borderBottom: activeTab === tab.id ? "2px solid #7e14ff" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* =========================================================
            TAB 1: OVERVIEW & DECISIONS
        ========================================================= */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
            {/* Executive Summary Card */}
            <div className="card-premium" style={{ padding: "28px", background: "#ffffff" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
                Meeting Summary
              </h3>
              {meeting.fullSummary ? (
                <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#334155", whiteSpace: "pre-line", margin: 0 }}>
                  {meeting.fullSummary}
                </p>
              ) : (
                <div style={{ padding: "24px 0", textAlign: "center", color: "#64748b" }}>
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>
                    No automated summary generated yet for this session.
                  </p>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={handleGenerateAiNotes}
                    disabled={isGeneratingNotes}
                  >
                    ✨ Generate Summary from Notes
                  </button>
                </div>
              )}
            </div>

            {/* Decisions Card */}
            <div className="card-premium" style={{ padding: "28px", background: "#ffffff" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>
                Decisions Made ({meeting.decisions.length})
              </h3>
              {meeting.decisions.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: 0 }}>
                  No decisions recorded yet. Run AI Summary on your notes to extract key decisions.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {meeting.decisions.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        background: "#faf9fd",
                        border: "1px solid #ece5f8"
                      }}
                    >
                      <strong style={{ display: "block", color: "#0f172a", fontSize: "0.95rem", marginBottom: "4px" }}>
                        ✓ {d.decision}
                      </strong>
                      {d.context && (
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{d.context}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: TRANSCRIPT
        ========================================================= */}
        {activeTab === "transcript" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Add Utterance Form */}
            <div className="card-premium" style={{ padding: "20px 24px", background: "#ffffff" }}>
              <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
                Add Spoken Utterance or Speech Fragment
              </h4>
              <form onSubmit={handleAddUtterance} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Speaker Name"
                  value={newTranscriptSpeaker}
                  onChange={(e) => setNewTranscriptSpeaker(e.target.value)}
                  style={{
                    width: "160px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem"
                  }}
                />
                <input
                  type="text"
                  placeholder="Paste or type spoken words..."
                  value={newTranscriptText}
                  onChange={(e) => setNewTranscriptText(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "240px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem"
                  }}
                />
                <button type="submit" className="btn-primary" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                  Add Line
                </button>
              </form>
            </div>

            {/* Utterances List */}
            {meeting.transcript.length === 0 ? (
              <div
                style={{
                  padding: "56px 20px",
                  textAlign: "center",
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px dashed #d8b4fe"
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>🎙️</div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  No transcript recorded yet
                </h4>
                <p style={{ fontSize: "0.9rem", color: "#64748b", maxWidth: "440px", margin: "0 auto", lineHeight: 1.6 }}>
                  Add speech utterances using the form above or paste raw notes in the Notes tab to run AI extraction.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {meeting.transcript.map((u) => (
                  <div
                    key={u.id}
                    className="card-premium"
                    style={{
                      padding: "16px 20px",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "14px"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "0.9rem", color: "#7e14ff" }}>
                          {u.speakerName}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          {u.timestamp}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.9375rem", color: "#334155", lineHeight: 1.6, margin: 0 }}>
                        "{u.originalText}"
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteUtterance(u.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        color: "#ef4444",
                        background: "transparent",
                        border: "1px solid #fee2e2",
                        cursor: "pointer"
                      }}
                      title="Delete utterance"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3: ACTION ITEMS
        ========================================================= */}
        {activeTab === "action-items" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Add Action Item Form */}
            <div className="card-premium" style={{ padding: "20px 24px", background: "#ffffff" }}>
              <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
                Add New Action Item
              </h4>
              <form onSubmit={handleAddActionItem} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Task description..."
                  value={newActionTask}
                  onChange={(e) => setNewActionTask(e.target.value)}
                  style={{
                    flex: 2,
                    minWidth: "220px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem"
                  }}
                />
                <input
                  type="text"
                  placeholder="Assignee"
                  value={newActionAssignee}
                  onChange={(e) => setNewActionAssignee(e.target.value)}
                  style={{
                    width: "140px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem"
                  }}
                />
                <input
                  type="text"
                  placeholder="Due Date"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                  style={{
                    width: "130px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem"
                  }}
                />
                <button type="submit" className="btn-primary" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                  + Add Item
                </button>
              </form>
            </div>

            {/* Action Items List */}
            {meeting.actionItems.length === 0 ? (
              <div
                style={{
                  padding: "56px 20px",
                  textAlign: "center",
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px dashed #d8b4fe"
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>✓</div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  No action items yet
                </h4>
                <p style={{ fontSize: "0.9rem", color: "#64748b", maxWidth: "420px", margin: "0 auto", lineHeight: 1.6 }}>
                  Create tasks above or run AI summary to extract action items automatically from your discussion.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {meeting.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="card-premium"
                    style={{
                      padding: "16px 20px",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleAction(item.id)}
                        style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#7e14ff" }}
                      />
                      <span
                        style={{
                          fontSize: "0.95rem",
                          color: item.completed ? "#94a3b8" : "#0f172a",
                          textDecoration: item.completed ? "line-through" : "none",
                          fontWeight: 500
                        }}
                      >
                        {item.task}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        Assignee: <strong>{item.assignee}</strong> • Due: {item.dueDate}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteAction(item.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "14px"
                        }}
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 4: NOTES & AGENDA
        ========================================================= */}
        {activeTab === "notes" && (
          <div className="card-premium" style={{ padding: "28px", background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
                Meeting Notes & Discussion Outline
              </h3>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleCopyNotes}
                  style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                >
                  Copy Notes
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleDownloadNotes}
                  style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                >
                  Download (.txt)
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  style={{ fontSize: "0.85rem", padding: "6px 18px" }}
                >
                  Save Notes
                </button>
              </div>
            </div>

            <textarea
              rows={14}
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="Record notes, talking points, decisions, or raw speech transcript here..."
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "0.95rem",
                fontFamily: "inherit",
                lineHeight: 1.7,
                outline: "none",
                resize: "vertical",
                background: "#fbfaff"
              }}
            />

            <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
              <span>Saved locally in browser session</span>
              <span>{notesContent.length} characters</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
