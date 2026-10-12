import React, { useState } from "react";

export const HowItWorks: React.FC = () => {
  const [showTechnicalPipeline, setShowTechnicalPipeline] = useState(false);

  const mainSteps = [
    {
      num: "1",
      title: "Speak Naturally",
      desc: "Click record and speak your thoughts aloud in your preferred language or mix languages naturally."
    },
    {
      num: "2",
      title: "VoxFlow Processes & Understands",
      desc: "Our engine transcribes your speech, extracts the core intent, and adapts tone and formatting for your context."
    },
    {
      num: "3",
      title: "Review & Insert the Text",
      desc: "Receive clear, polished writing placed directly into your input field or copied to your clipboard in seconds."
    }
  ];

  const pipelineStages = [
    { name: "Transcribe", desc: "High-accuracy audio transcription." },
    { name: "Detect Language", desc: "Recognizes primary language and code-switching." },
    { name: "Understand", desc: "Extracts underlying meaning and key details." },
    { name: "Detect Context", desc: "Identifies channel, formality, and audience." },
    { name: "Transform", desc: "Generates formatted, ready-to-use prose." }
  ];

  return (
    <section
      id="how-it-works"
      className="section-spacing"
      style={{
        background: "linear-gradient(180deg, rgba(251, 249, 254, 0.4) 0%, #f6f3fc 50%, rgba(251, 249, 254, 0.4) 100%)",
        position: "relative"
      }}
    >
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge badge-glow">Simple Workflow</span>
          <h2>How It Works</h2>
          <p>
            Three simple steps between your spoken words and polished writing on the web.
          </p>
        </div>

        {/* 3 Main Steps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            marginBottom: "32px"
          }}
        >
          {mainSteps.map((step) => (
            <div
              key={step.num}
              className="card-premium"
              style={{
                background: "#ffffff",
                padding: "32px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                position: "relative"
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#f3e8ff",
                  color: "#7e14ff",
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-heading)"
                }}
              >
                {step.num}
              </div>

              <h3
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  fontSize: "0.925rem",
                  lineHeight: 1.6,
                  color: "#64748b",
                  margin: 0
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Secondary Technical Pipeline Toggle */}
        <div style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => setShowTechnicalPipeline(!showTechnicalPipeline)}
            style={{
              background: "transparent",
              border: "1px solid #e2d9f3",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#7e14ff",
              cursor: "pointer"
            }}
          >
            {showTechnicalPipeline ? "Hide Technical Pipeline Details ↑" : "See Technical Architecture (5-Stage Pipeline) ↓"}
          </button>

          {showTechnicalPipeline && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#ffffff",
                borderRadius: "16px",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                textAlign: "left"
              }}
            >
              {pipelineStages.map((stage, idx) => (
                <div
                  key={stage.name}
                  style={{
                    background: "#faf9fd",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #ece5f8"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#7e14ff", fontWeight: 700 }}>
                    Stage 0{idx + 1}
                  </span>
                  <strong style={{ display: "block", fontSize: "0.875rem", color: "#0f172a", marginTop: "2px" }}>
                    {stage.name}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4, display: "block", marginTop: "4px" }}>
                    {stage.desc}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
