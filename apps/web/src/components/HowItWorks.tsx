import React, { useState } from "react";

export const HowItWorks: React.FC = () => {
  const [showTechnicalPipeline, setShowTechnicalPipeline] = useState(false);

  const mainSteps = [
    {
      step: "01",
      title: "Speak naturally",
      desc: "Activate VoxFlow in any text field or meeting. Talk freely as ideas come to mind in English, Hindi, or mixed languages without pausing for punctuation or manual commands."
    },
    {
      step: "02",
      title: "VoxFlow processes your speech",
      desc: "Our engine transcribes speech with code-switching awareness, detects communication context, eliminates filler words, and refines grammar into clear, structured sentences."
    },
    {
      step: "03",
      title: "Use your text in your workflow",
      desc: "Polished output is placed directly into your email, Slack channel, Notion doc, or meeting summary ready for immediate sending or sharing with your team."
    }
  ];

  const pipelineStages = [
    { name: "Transcribe", desc: "Whisper speech-to-text with multilingual acoustic models." },
    { name: "Detect Language", desc: "Identifies primary language and conversational code-switching." },
    { name: "Understand Intent", desc: "Extracts underlying communication intent and key points." },
    { name: "Detect Context", desc: "Infers destination, tone requirements, and recipient formality." },
    { name: "Transform", desc: "Generates formatted, ready-to-use prose matching the target channel." }
  ];

  return (
    <section
      id="how-it-works"
      className="section-spacing"
      style={{
        background: "#ffffff",
        position: "relative"
      }}
    >
      <div className="container">
        {/* Section Header */}
        <div className="section-title-wrap">
          <span className="badge">Simple Workflow</span>
          <h2>Speak, get polished text</h2>
          <p>
            From spoken thought to polished prose in three effortless steps.
          </p>
        </div>

        {/* 3 Step Flow */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "24px",
            maxWidth: "1120px",
            margin: "0 auto 40px auto"
          }}
        >
          {mainSteps.map((step) => (
            <div
              key={step.step}
              style={{
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "12px",
                padding: "clamp(20px, 4vw, 32px) clamp(16px, 3.5vw, 28px)",
                display: "flex",
                flexDirection: "column",
                position: "relative"
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "38px",
                  height: "38px",
                  borderRadius: "8px",
                  background: "#111111",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  marginBottom: "20px"
                }}
              >
                {step.step}
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
                {step.title}
              </h3>

              <p
                style={{
                  fontSize: "0.9375rem",
                  lineHeight: 1.6,
                  color: "#555555",
                  margin: 0
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Working Architecture Viewer */}
        <div style={{ textAlign: "center", maxWidth: "860px", margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => setShowTechnicalPipeline(!showTechnicalPipeline)}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "6px",
              padding: "10px 20px",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#111111",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
          >
            {showTechnicalPipeline ? "Hide Pipeline Architecture ↑" : "View Pipeline Architecture (5 Stages) ↓"}
          </button>

          {showTechnicalPipeline && (
            <div
              style={{
                marginTop: "24px",
                padding: "24px",
                background: "#fcfcfc",
                border: "1px solid #e5e5e5",
                borderRadius: "10px",
                textAlign: "left"
              }}
            >
              <h4
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "#111111",
                  marginBottom: "16px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Engine Pipeline Execution Stages:
              </h4>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "14px"
                }}
              >
                {pipelineStages.map((stage, idx) => (
                  <div
                    key={stage.name}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e5e5",
                      borderRadius: "6px",
                      padding: "14px 12px"
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#888888",
                        fontWeight: 600,
                        marginBottom: "4px"
                      }}
                    >
                      Stage {idx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#111111",
                        marginBottom: "4px"
                      }}
                    >
                      {stage.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666666", lineHeight: 1.4 }}>
                      {stage.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
