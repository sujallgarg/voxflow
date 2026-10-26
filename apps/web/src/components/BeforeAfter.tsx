import React, { useState } from "react";

interface ComparisonScenario {
  id: string;
  label: string;
  context: string;
  detectedLang: string;
  spoken: {
    title: string;
    text: string;
    note: string;
  };
  written: {
    title: string;
    text: string;
    format: string;
  };
}

const COMPARISON_SCENARIOS: ComparisonScenario[] = [
  {
    id: "client-update",
    label: "Multilingual Client Update",
    context: "Email to Product Team",
    detectedLang: "English / Hindi (Code-switching)",
    spoken: {
      title: "Natural Spoken Thoughts",
      text: "“Hey team, kal ka client demo actually went really well, bas unhone bola ki latency metrics dashboard pe dikhana chahiye and export button ka styling thoda clean kardo, please Monday tak update ready rakhna taaki hum review kar sakein.”",
      note: "Spoken conversationally with natural code-switching and informal pacing."
    },
    written: {
      title: "Polished VoxFlow Output",
      text: "Hi Team,\n\nYesterday's client demonstration was successful. The client requested two minor adjustments:\n• Display latency metrics prominently on the main dashboard.\n• Refine the visual styling of the export button.\n\nPlease ensure these updates are finalized by Monday for our scheduled review.",
      format: "Formatted Business Email"
    }
  },
  {
    id: "slack-action-items",
    label: "Quick Team Huddle",
    context: "Slack / Teams Message",
    detectedLang: "English",
    spoken: {
      title: "Natural Spoken Thoughts",
      text: "“Okay so regarding the release tomorrow we definitely need Sarah to verify the payment webhook endpoints and Alex should double check the mobile layout on Safari, if both look good let’s trigger the build at 4 PM.”",
      note: "Rapid stream-of-consciousness thought without manual formatting."
    },
    written: {
      title: "Polished VoxFlow Output",
      text: "Release Checklist for Tomorrow:\n• @Sarah: Verify payment webhook endpoints.\n• @Alex: Audit mobile layout compatibility on Safari.\n\nTarget build trigger: 4:00 PM if both checks pass.",
      format: "Structured Slack Update"
    }
  },
  {
    id: "meeting-notes",
    label: "Meeting Brief",
    context: "Workspace Document",
    detectedLang: "English",
    spoken: {
      title: "Natural Spoken Thoughts",
      text: "“We talked about the enterprise onboarding flow and everyone agreed that three mandatory steps is too much for self-serve users, so we're going to combine workspace creation with team invites and test that for two weeks.”",
      note: "Meeting discussion captured on the fly."
    },
    written: {
      title: "Polished VoxFlow Output",
      text: "Decision Summary — Onboarding Simplification\n\n• Consensus: A three-step mandatory flow introduces unnecessary friction for self-serve signups.\n• Action: Merge workspace creation and team invitations into a single initial step.\n• Timeline: Run a two-week cohort experiment to measure completion rates.",
      format: "Concise Executive Note"
    }
  }
];

export const BeforeAfter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("client-update");
  const [copied, setCopied] = useState<boolean>(false);

  const scenario = COMPARISON_SCENARIOS.find((s) => s.id === activeTab) || COMPARISON_SCENARIOS[0];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard permission error
    }
  };

  return (
    <section
      id="before-after"
      className="section-spacing"
      style={{
        background: "#fafafa",
        borderTop: "1px solid #e5e5e5",
        borderBottom: "1px solid #e5e5e5"
      }}
    >
      <div className="container">
        {/* Section Title */}
        <div className="section-title-wrap">
          <span className="badge">Speech Transformation</span>
          <h2>See the Difference in Real Time</h2>
          <p>
            You speak the way your thoughts flow. VoxFlow understands your intent, filters
            filler words, resolves mixed languages, and produces polished, ready-to-send text.
          </p>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "32px"
          }}
        >
          {COMPARISON_SCENARIOS.map((s) => {
            const isActive = s.id === activeTab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveTab(s.id)}
                style={{
                  padding: "8px 16px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  borderRadius: "6px",
                  background: isActive ? "#111111" : "#ffffff",
                  color: isActive ? "#ffffff" : "#666666",
                  border: `1px solid ${isActive ? "#111111" : "#e5e5e5"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Comparison Panel */}
        <div
          style={{
            maxWidth: "1080px",
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            overflow: "hidden"
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: "14px 20px",
              background: "#ffffff",
              borderBottom: "1px solid #e5e5e5",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#111111"
                }}
              >
                Scenario: {scenario.context}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#f5f5f5",
                  border: "1px solid #e5e5e5",
                  color: "#666666"
                }}
              >
                {scenario.detectedLang}
              </span>
            </div>

            <div style={{ fontSize: "0.8125rem", color: "#666666" }}>
              Target: <strong style={{ color: "#111111" }}>{scenario.written.format}</strong>
            </div>
          </div>

          {/* Two Columns Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              borderTop: "none"
            }}
          >
            {/* Left: What You Say */}
            <div
              style={{
                padding: "clamp(20px, 4vw, 28px) clamp(16px, 3.5vw, 24px)",
                borderRight: "1px solid #e5e5e5",
                borderBottom: "1px solid #e5e5e5",
                background: "#fcfcfc",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "14px"
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#ef4444"
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#666666"
                    }}
                  >
                    Raw Spoken Speech
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "0.9375rem",
                    lineHeight: 1.65,
                    color: "#444444",
                    fontStyle: "italic",
                    whiteSpace: "pre-wrap",
                    minHeight: "140px"
                  }}
                >
                  {scenario.spoken.text}
                </div>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "14px",
                  borderTop: "1px solid #eeeeee",
                  fontSize: "0.8125rem",
                  color: "#777777"
                }}
              >
                {scenario.spoken.note}
              </div>
            </div>

            {/* Right: What VoxFlow Produces */}
            <div
              style={{
                padding: "clamp(20px, 4vw, 28px) clamp(16px, 3.5vw, 24px)",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "14px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#16a34a"
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#111111"
                      }}
                    >
                      Refined Written Output
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(scenario.written.text)}
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: copied ? "#111111" : "#f5f5f5",
                      color: copied ? "#ffffff" : "#111111",
                      border: "1px solid #e5e5e5",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {copied ? "Copied" : "Copy Text"}
                  </button>
                </div>

                <div
                  style={{
                    fontSize: "0.9375rem",
                    lineHeight: 1.65,
                    color: "#111111",
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-body)",
                    minHeight: "140px"
                  }}
                >
                  {scenario.written.text}
                </div>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "14px",
                  borderTop: "1px solid #f0f0f0",
                  fontSize: "0.8125rem",
                  color: "#16a34a",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>✓</span>
                <span>Punctuation, tone formatting, and grammar automatically applied</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
