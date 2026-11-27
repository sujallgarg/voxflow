import React, { useState, useEffect, useRef } from "react";
import type { MeetingSnapshot } from "../../data/meetingCompanionData";
import { SmartMeetingSnapshotManager } from "../../lib/snapshotCaptureEngine";

interface MeetingSnapshotsGalleryProps {
  meeting: any;
  onUpdateMeeting: (updated: any) => void;
  externalManager?: SmartMeetingSnapshotManager | null;
}

export const MeetingSnapshotsGallery: React.FC<MeetingSnapshotsGalleryProps> = ({
  meeting,
  onUpdateMeeting,
  externalManager
}) => {
  const [snapshots, setSnapshots] = useState<MeetingSnapshot[]>(meeting.snapshots || []);
  const [selectedSnapshot, setSelectedSnapshot] = useState<MeetingSnapshot | null>(null);
  const [captureStatus, setCaptureStatus] = useState<{
    isActive: boolean;
    isPaused: boolean;
    count: number;
    hasStream: boolean;
  }>({
    isActive: false,
    isPaused: false,
    count: (meeting.snapshots || []).length,
    hasStream: false
  });
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const managerRef = useRef<SmartMeetingSnapshotManager | null>(null);

  useEffect(() => {
    setSnapshots(meeting.snapshots || []);
  }, [meeting.snapshots]);

  // Connect to internal or external snapshot manager
  useEffect(() => {
    const mgr = externalManager || new SmartMeetingSnapshotManager(meeting.id, meeting.title);
    managerRef.current = mgr;

    mgr.setMeetingContext(meeting.id, meeting.title);

    mgr.onSnapshot((newSnap) => {
      setSnapshots((prev) => {
        const updated = [newSnap, ...prev];
        onUpdateMeeting({
          ...meeting,
          snapshots: updated
        });
        return updated;
      });
      showMessage(`📸 New snapshot saved: ${newSnap.category}`);
    });

    mgr.onStatusChange((st) => {
      setCaptureStatus({
        ...st,
        hasStream: mgr.getStatus().hasStream
      });
    });

    setCaptureStatus(mgr.getStatus());

    return () => {
      if (!externalManager) {
        mgr.stop();
      }
    };
  }, [meeting.id, meeting.title, externalManager]);

  const showMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const handleStartSmartCapture = async () => {
    const mgr = managerRef.current;
    if (!mgr) return;

    try {
      setIsStartingStream(true);
      const ok = await mgr.requestMeetingTabMedia();
      if (ok) {
        mgr.start(3500);
        showMessage("🟢 Smart Screen Capture active! Sampling slides and charts.");
      }
    } catch (err: any) {
      console.warn("Could not start display capture:", err);
      if (err?.name === "NotAllowedError") {
        showMessage("Notice: Screen/tab sharing permission was cancelled.");
      } else {
        showMessage(err?.message || "Could not access screen/tab. Please try again.");
      }
    } finally {
      setIsStartingStream(false);
    }
  };

  const handlePauseResume = () => {
    const mgr = managerRef.current;
    if (!mgr) return;
    if (captureStatus.isPaused) {
      mgr.resume();
      showMessage("▶ Screen capture resumed.");
    } else {
      mgr.pause();
      showMessage("⏸ Screen capture paused.");
    }
  };

  const handleStopCapture = () => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.stop();
    showMessage("Screen capture stopped.");
  };

  const handleManualSnap = async () => {
    const mgr = managerRef.current;
    if (!mgr || !captureStatus.hasStream) {
      // If no stream is active, prompt to select screen first
      try {
        setIsStartingStream(true);
        const ok = await mgr?.requestMeetingTabMedia();
        if (ok) {
          const snap = await mgr?.snapManual();
          if (snap) {
            showMessage("📸 Manual snapshot captured!");
          }
        }
      } catch (err: any) {
        showMessage(err?.message || "Unable to capture screen.");
      } finally {
        setIsStartingStream(false);
      }
      return;
    }

    const snap = await mgr.snapManual();
    if (snap) {
      showMessage("📸 Manual snapshot captured!");
    } else {
      showMessage("Could not capture frame. Ensure video is visible.");
    }
  };

  const handleDeleteSnapshot = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm("Delete this meeting snapshot?")) return;
    const updated = snapshots.filter((s) => s.id !== id);
    setSnapshots(updated);
    onUpdateMeeting({
      ...meeting,
      snapshots: updated
    });
    if (selectedSnapshot?.id === id) {
      setSelectedSnapshot(null);
    }
    showMessage("Snapshot removed.");
  };

  const handleDownloadSnapshot = (snap: MeetingSnapshot, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = document.createElement("a");
    link.href = snap.imageUrl;
    const safeTitle = (meeting.title || "meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.download = `${safeTitle}-snapshot-${snap.timestamp.replace(/[^a-z0-9]+/gi, "-")}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Slide":
        return { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
      case "Chart / Metrics":
        return { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" };
      case "Diagram / Architecture":
        return { bg: "#faf5ff", color: "#6b21a8", border: "#e9d5ff" };
      case "Document / Notes":
        return { bg: "#fffbeb", color: "#92400e", border: "#fde68a" };
      case "Product Demo":
        return { bg: "#fdf2f8", color: "#9d174d", border: "#fbcfe8" };
      default:
        return { bg: "#f3f4f6", color: "#1f2937", border: "#e5e7eb" };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* =========================================================
          CONTROL & STATUS BAR
      ========================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: captureStatus.isActive
                  ? captureStatus.isPaused
                    ? "#eab308"
                    : "#22c55e"
                  : "#9ca3af",
                boxShadow: captureStatus.isActive && !captureStatus.isPaused ? "0 0 0 3px rgba(34, 197, 94, 0.2)" : "none"
              }}
            />
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111111" }}>
              {captureStatus.isActive
                ? captureStatus.isPaused
                  ? "Screen Capture Paused"
                  : "Smart Capture Active"
                : "Screen Capture Idle"}
            </span>
          </div>

          <span style={{ fontSize: "0.8125rem", color: "#666666" }}>
            • {snapshots.length} {snapshots.length === 1 ? "snapshot" : "snapshots"} saved
          </span>

          {statusMessage && (
            <span
              style={{
                fontSize: "0.8125rem",
                color: "#111111",
                background: "#f4f4f5",
                padding: "3px 10px",
                borderRadius: "4px",
                fontWeight: 500
              }}
            >
              {statusMessage}
            </span>
          )}
        </div>

        {/* Capture Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {!captureStatus.isActive ? (
            <button
              type="button"
              onClick={handleStartSmartCapture}
              disabled={isStartingStream}
              style={{
                padding: "8px 14px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                background: "#111111",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              <span>{isStartingStream ? "Connecting Tab..." : "Start Smart Capture"}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePauseResume}
                style={{
                  padding: "8px 12px",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  background: "#ffffff",
                  color: "#111111",
                  border: "1px solid #d4d4d8",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                {captureStatus.isPaused ? "▶ Resume" : "⏸ Pause"}
              </button>
              <button
                type="button"
                onClick={handleStopCapture}
                style={{
                  padding: "8px 12px",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                ■ Stop Capture
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleManualSnap}
            disabled={isStartingStream}
            style={{
              padding: "8px 14px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              background: "#ffffff",
              color: "#111111",
              border: "1px solid #111111",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Snap Now</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          SNAPSHOTS GRID
      ========================================================= */}
      {snapshots.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            padding: "48px 24px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#f4f4f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 600, color: "#111111" }}>
            No Meeting Snapshots Yet
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: "0.875rem", color: "#666666", maxWidth: "460px", marginInline: "auto" }}>
            Start Smart Screen Capture or click &quot;Snap Now&quot; during your Google Meet, Zoom, or Teams call to
            automatically detect and save important slides, charts, architecture diagrams, and documents.
          </p>
          <button
            type="button"
            onClick={handleStartSmartCapture}
            style={{
              padding: "10px 18px",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: "#111111",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Start Smart Capture
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: "18px"
          }}
        >
          {snapshots.map((snap) => {
            const catColors = getCategoryColor(snap.category);
            return (
              <div
                key={snap.id}
                onClick={() => setSelectedSnapshot(snap)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  overflow: "hidden",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                }}
              >
                {/* Image Preview Container */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#f4f4f5" }}>
                  <img
                    src={snap.imageUrl}
                    alt={snap.title || snap.description}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block"
                    }}
                    loading="lazy"
                  />
                  {/* Category and Timestamp badges */}
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      display: "flex",
                      gap: "6px"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: catColors.bg,
                        color: catColors.color,
                        border: `1px solid ${catColors.border}`
                      }}
                    >
                      {snap.category}
                    </span>
                    {snap.manual && (
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(0, 0, 0, 0.75)",
                          color: "#ffffff"
                        }}
                      >
                        Manual
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      right: "8px",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(0, 0, 0, 0.75)",
                      color: "#ffffff"
                    }}
                  >
                    {snap.timestamp}
                  </span>
                </div>

                {/* Content Info */}
                <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: "0.8125rem",
                      lineHeight: "1.4",
                      color: "#333333",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}
                  >
                    {snap.description}
                  </p>

                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: "1px solid #f4f4f5",
                      paddingTop: "8px"
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#888888" }}>Click to view high-res</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadSnapshot(snap, e)}
                        title="Download image"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#666666",
                          padding: "4px"
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                        title="Delete snapshot"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#dc2626",
                          padding: "4px"
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          FULL-SCREEN LIGHTBOX MODAL
      ========================================================= */}
      {selectedSnapshot && (
        <div
          onClick={() => setSelectedSnapshot(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              maxWidth: "1000px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e5e5e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px"
              }}
            >
              <div>
                <h4 style={{ margin: "0 0 2px", fontSize: "1rem", fontWeight: 600, color: "#111111" }}>
                  {selectedSnapshot.category} • {selectedSnapshot.timestamp}
                </h4>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "#666666" }}>
                  {selectedSnapshot.description}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleDownloadSnapshot(selectedSnapshot)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#111111",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Download High-Res
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSnapshot(selectedSnapshot.id)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#fee2e2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSnapshot(null)}
                  style={{
                    padding: "6px 10px",
                    fontSize: "1.1rem",
                    lineHeight: "1",
                    background: "transparent",
                    color: "#666666",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Image Display */}
            <div
              style={{
                flex: 1,
                background: "#09090b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                overflow: "auto"
              }}
            >
              <img
                src={selectedSnapshot.imageUrl}
                alt={selectedSnapshot.description}
                style={{
                  maxWidth: "100%",
                  maxHeight: "72vh",
                  objectFit: "contain",
                  borderRadius: "4px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)"
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
