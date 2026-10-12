import React, { useState } from "react";

export const ProductPreview: React.FC = () => {
  const [activeTabMode, setActiveTabMode] = useState<"mic" | "tab">("mic");
  const [viewState, setViewState] = useState<"recording" | "processing" | "completed">("completed");
  const [targetLanguage, setTargetLanguage] = useState<string>("English");
  const [insertedNotification, setInsertedNotification] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  const sampleTransformed =
    "Good morning Alex,\n\nWe have reviewed the latest benchmark numbers. The query latency has stabilized well under 12ms. We're greenlit to proceed with the staged rollout this afternoon.\n\nBest,";

  const handleInsert = () => {
    setInsertedNotification(true);
    setTimeout(() => setInsertedNotification(false), 2400);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sampleTransformed);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2400);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <section
      id="preview"
      className="section-spacing"
      style={{
        background: "linear-gradient(180deg, #fbf9fe 0%, #f4f0fa 50%, #fbf9fe 100%)",
        position: "relative"
      }}
    >
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge badge-glow">Extension Deep Dive</span>
          <h2>The Floating Power of VoxFlow</h2>
          <p>
            Experience how the extension looks and works inside your browser.
            Toggle between recording, processing, and completed states below.
          </p>
        </div>

        {/* State Switcher Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "32px",
            flexWrap: "wrap"
          }}
        >
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginRight: "6px" }}>
            Preview Extension State:
          </span>

          <button
            type="button"
            onClick={() => setViewState("recording")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: viewState === "recording" ? "#7e14ff" : "#ffffff",
              color: viewState === "recording" ? "#ffffff" : "#475569",
              border: "1px solid " + (viewState === "recording" ? "#7e14ff" : "var(--border-subtle)")
            }}
          >
            🔴 Recording State
          </button>

          <button
            type="button"
            onClick={() => setViewState("processing")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: viewState === "processing" ? "#7e14ff" : "#ffffff",
              color: viewState === "processing" ? "#ffffff" : "#475569",
              border: "1px solid " + (viewState === "processing" ? "#7e14ff" : "var(--border-subtle)")
            }}
          >
            ⚡ Processing Pipeline
          </button>

          <button
            type="button"
            onClick={() => setViewState("completed")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: viewState === "completed" ? "#7e14ff" : "#ffffff",
              color: viewState === "completed" ? "#ffffff" : "#475569",
              border: "1px solid " + (viewState === "completed" ? "#7e14ff" : "var(--border-subtle)")
            }}
          >
            ✓ Completed & Injected
          </button>
        </div>

        {/* Big Extension Window Card */}
        <div
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "24px",
            border: "1px solid rgba(126, 20, 255, 0.22)",
            boxShadow:
              "0 25px 65px -15px rgba(126, 20, 255, 0.18), 0 10px 25px -5px rgba(15, 23, 42, 0.05)",
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "#faf9fd",
              borderBottom: "1px solid #f1edf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #7e14ff 0%, #a855f7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 800
                }}
              >
                V
              </div>
              <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
                VoxFlow Assistant
              </strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background:
                    viewState === "recording"
                      ? "#ef4444"
                      : viewState === "processing"
                      ? "#f59e0b"
                      : "#10b981"
                }}
              />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "capitalize" }}>
                {viewState}
              </span>
            </div>
          </div>

          {/* Controls Body */}
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Audio Mode Tabs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#f4f1fa",
                padding: "4px",
                borderRadius: "12px",
                gap: "4px"
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTabMode("mic")}
                style={{
                  padding: "9px",
                  borderRadius: "9px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: activeTabMode === "mic" ? "#ffffff" : "transparent",
                  color: activeTabMode === "mic" ? "#7e14ff" : "#64748b",
                  boxShadow: activeTabMode === "mic" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <span>🎙</span>
                <span>Microphone</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTabMode("tab")}
                style={{
                  padding: "9px",
                  borderRadius: "9px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: activeTabMode === "tab" ? "#ffffff" : "transparent",
                  color: activeTabMode === "tab" ? "#7e14ff" : "#64748b",
                  boxShadow: activeTabMode === "tab" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <span>🔊</span>
                <span>Listen to Tab</span>
              </button>
            </div>

            {/* Target Language Select */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  marginBottom: "6px"
                }}
              >
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #e2e0ed",
                  fontSize: "0.9375rem",
                  color: "#1e293b",
                  background: "#ffffff",
                  cursor: "pointer"
                }}
              >
                <option value="English">Auto / English</option>
                <option value="Hinglish">Hinglish (Hindi + English)</option>
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
                <option value="Japanese">Japanese (日本語)</option>
              </select>
            </div>

            {/* State Representation */}
            {viewState === "recording" && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "16px",
                  padding: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "#ef4444",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px"
                    }}
                    className="pulse-active"
                  >
                    🎙
                  </div>
                  <div>
                    <strong style={{ display: "block", color: "#991b1b", fontSize: "0.95rem" }}>
                      Listening to speech...
                    </strong>
                    <span style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>
                      Timer: 00:07 • Press Stop to Transform
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "3px", height: "24px" }}>
                  <div className="waveform-bar" style={{ background: "#ef4444" }} />
                  <div className="waveform-bar" style={{ background: "#ef4444", animationDelay: "0.2s" }} />
                  <div className="waveform-bar" style={{ background: "#ef4444", animationDelay: "0.4s" }} />
                </div>
              </div>
            )}

            {viewState === "processing" && (
              <div
                style={{
                  background: "#faf5ff",
                  border: "1px solid #e9d5ff",
                  borderRadius: "16px",
                  padding: "20px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                  <span className="pulse-active" style={{ fontSize: "20px" }}>
                    ⚡
                  </span>
                  <div>
                    <strong style={{ display: "block", color: "#6b21a8", fontSize: "0.95rem" }}>
                      Running AI Pipeline (Step 4/5)
                    </strong>
                    <span style={{ fontSize: "0.8125rem", color: "#9333ea" }}>
                      Detecting Context & Formality...
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    height: "6px",
                    background: "#f3e8ff",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "80%",
                      background: "linear-gradient(90deg, #7e14ff, #38bdf8)",
                      borderRadius: "4px"
                    }}
                  />
                </div>
              </div>
            )}

            {viewState === "completed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Raw Transcript Bubble */}
                <div
                  style={{
                    background: "#f8f6fc",
                    borderRadius: "12px",
                    padding: "14px",
                    border: "1px solid #ece5f8",
                    fontSize: "0.875rem"
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      marginBottom: "4px"
                    }}
                  >
                    Raw Transcript:
                  </span>
                  <p style={{ color: "#475569", margin: 0, fontStyle: "italic" }}>
                    "morning Alex we checked the latest benchmark numbers query latency is way under 12ms good to rollout this afternoon"
                  </p>
                </div>

                {/* Final Context Output */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    padding: "16px",
                    border: "1px solid rgba(126, 20, 255, 0.25)",
                    boxShadow: "0 2px 10px rgba(126, 20, 255, 0.05)",
                    fontSize: "0.9375rem"
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#7e14ff",
                      textTransform: "uppercase",
                      marginBottom: "6px"
                    }}
                  >
                    Final Transformed Text:
                  </span>
                  <div style={{ color: "#0f172a", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                    {sampleTransformed}
                  </div>
                </div>

                {/* Bottom Action Buttons: Insert into page & Copy */}
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleInsert}
                    style={{ flex: 1, padding: "12px", fontSize: "0.875rem" }}
                  >
                    {insertedNotification ? "✓ Inserted Into Input!" : "Insert into Field"}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCopy}
                    style={{ padding: "12px 18px", fontSize: "0.875rem" }}
                  >
                    {copiedNotification ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
