import React from "react";

export const Features: React.FC = () => {
  const coreFeatures = [
    {
      id: "multilingual-voice-input",
      tag: "Speech Engine",
      title: "Multilingual Voice Input",
      description:
        "Speak in your preferred language or naturally switch languages mid-sentence (code-switching like Hinglish or Spanglish) without toggling manual settings.",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      highlight: "Supports natural code-switching"
    },
    {
      id: "context-aware-improvement",
      tag: "AI Structuring",
      title: "Context-Aware Text Improvement",
      description:
        "Transforms spoken intent into structured sentences with accurate grammar, appropriate punctuation, and tone tailored for professional email, docs, or chat.",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      highlight: "Removes filler words & adapts tone"
    },
    {
      id: "browser-writing-workflow",
      tag: "Productivity",
      title: "Dictate Into Gmail, Slack and Docs",
      description:
        "Integrates directly into your browser workflow so you can draft emails in Gmail, compose updates in Slack, and write reports in Google Docs without manual copy-paste.",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      highlight: "Insert text in place with a hotkey"
    },
    {
      id: "meeting-transcription-summaries",
      tag: "Workspace",
      title: "Meetings Turned into Clear Summaries",
      description:
        "Capture live meeting audio directly in your browser. VoxFlow generates full timestamped transcripts, key decisions, and prioritized action items automatically.",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      ),
      highlight: "Action items & decisions, listed"
    }
  ];

  return (
    <section
      id="features"
      className="section-spacing"
      style={{
        background: "#fafafa",
        borderTop: "1px solid #e5e5e5",
        borderBottom: "1px solid #e5e5e5"
      }}
    >
      <div id="product" style={{ position: "relative", top: "-80px" }} aria-hidden="true" />
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge">Core Capabilities</span>
          <h2>Built for the Modern Writing Workflow</h2>
          <p>
            Four verified capabilities designed to convert spoken thoughts into clear, publication-grade writing.
          </p>
        </div>

        {/* Balanced 2x2 Feature Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "24px",
            maxWidth: "1120px",
            margin: "0 auto"
          }}
        >
          {coreFeatures.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "12px",
                padding: "clamp(20px, 4vw, 32px) clamp(16px, 3.5vw, 28px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease"
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "20px"
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "8px",
                      background: "#fafafa",
                      border: "1px solid #e5e5e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {item.icon}
                  </div>

                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#666666",
                      background: "#f5f5f5",
                      padding: "3px 8px",
                      borderRadius: "4px"
                    }}
                  >
                    {item.tag}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#111111",
                    marginBottom: "12px",
                    lineHeight: 1.3
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    fontSize: "0.9375rem",
                    lineHeight: 1.6,
                    color: "#555555",
                    margin: 0
                  }}
                >
                  {item.description}
                </p>
              </div>

              <div
                style={{
                  marginTop: "24px",
                  paddingTop: "14px",
                  borderTop: "1px solid #f0f0f0",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#111111",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>→</span>
                <span>{item.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
