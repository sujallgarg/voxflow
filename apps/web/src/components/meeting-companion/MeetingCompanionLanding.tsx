import React from "react";

export const MeetingCompanionLanding: React.FC = () => {
  return (
    <section
      id="meeting-companion"
      className="section-spacing"
      style={{
        background: "#ffffff",
        position: "relative"
      }}
    >
      <div className="container">
        {/* Split Layout Container */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "48px",
            alignItems: "center",
            maxWidth: "1120px",
            margin: "0 auto"
          }}
        >
          {/* Left Column: Product Story */}
          <div>
            <span className="badge" style={{ marginBottom: "16px" }}>
              Integrated Meeting Intelligence
            </span>

            <h2
              style={{
                fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#111111",
                marginBottom: "20px",
                lineHeight: 1.18
              }}
            >
              Capture every conversation without breaking focus.
            </h2>

            <p
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.65,
                color: "#555555",
                marginBottom: "28px"
              }}
            >
              VoxFlow seamlessly bridges daily voice typing with long-form meeting capture.
              Record discussions directly in your browser, generate accurate multilingual transcripts,
              and extract executive summaries with actionable next steps.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "36px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#111111",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px"
                  }}
                >
                  ✓
                </div>
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111111", margin: "0 0 2px 0" }}>
                    Automated Executive Summaries
                  </h4>
                  <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                    Instant structured overviews highlighting core discussion topics and conclusions.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#111111",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px"
                  }}
                >
                  ✓
                </div>
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111111", margin: "0 0 2px 0" }}>
                    Extracted Action Items & Decisions
                  </h4>
                  <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                    Identify assigned team members, deliverables, and critical commitments automatically.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#111111",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px"
                  }}
                >
                  ✓
                </div>
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111111", margin: "0 0 2px 0" }}>
                    Multilingual Conversation Support
                  </h4>
                  <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                    Transcribes multilingual team dialogue and code-switching accurately in one place.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <a
                href="#/meetings"
                className="btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: "0.9375rem",
                  textDecoration: "none"
                }}
              >
                Open Meeting Workspace →
              </a>
            </div>
          </div>

          {/* Right Column: Workspace UI Preview Panel */}
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #e5e5e5",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)"
            }}
          >
            {/* Mock Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: "16px",
                borderBottom: "1px solid #e5e5e5",
                marginBottom: "18px"
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#16a34a",
                    background: "#dcfce7",
                    padding: "2px 8px",
                    borderRadius: "4px"
                  }}
                >
                  Completed • 38 mins
                </span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", margin: "8px 0 0 0" }}>
                  Product Roadmap & Architecture Sync
                </h3>
              </div>
              <span style={{ fontSize: "0.8125rem", color: "#777777" }}>Live Capture</span>
            </div>

            {/* Mock Summary Box */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px"
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#111111",
                  marginBottom: "8px"
                }}
              >
                AI Executive Summary
              </div>
              <p style={{ fontSize: "0.875rem", color: "#444444", lineHeight: 1.55, margin: 0 }}>
                The team aligned on the Q3 release schedule. Backend endpoints for quota tracking will finalize
                by Friday, and browser extension packaging will proceed immediately following payment webhook validation.
              </p>
            </div>

            {/* Mock Key Action Items */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                padding: "16px"
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#111111",
                  marginBottom: "10px"
                }}
              >
                Extracted Action Items
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8125rem", color: "#333333" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked readOnly style={{ accentColor: "#111111" }} />
                  <span>Finalize quota check endpoint error handling</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked readOnly style={{ accentColor: "#111111" }} />
                  <span>Run full cross-browser audio permission audit</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked readOnly style={{ accentColor: "#111111" }} />
                  <span>Verify Dodo Payments sandbox test suite pass</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
