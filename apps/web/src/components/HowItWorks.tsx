import React, { useState } from "react";

export const HowItWorks: React.FC = () => {
  const [showTechnicalPipeline, setShowTechnicalPipeline] = useState(false);

  const mainSteps = [
    {
      num: "1",
      title: "Speak Naturally",
      desc: "Activate the extension and speak your thoughts aloud in your preferred language or mix languages freely."
    },
    {
      num: "2",
      title: "Process & Contextualize",
      desc: "VoxFlow transcribes speech, extracts intent, and formats the output with appropriate tone for your recipient."
    },
    {
      num: "3",
      title: "Review & Insert",
      desc: "Receive clean, polished prose placed directly into your input field or copied to your clipboard in seconds."
    }
  ];

  const pipelineStages = [
    { name: "Transcribe", desc: "Speech-to-text transcription engine." },
    { name: "Detect Language", desc: "Identifies primary language and code-switching." },
    { name: "Understand Intent", desc: "Extracts underlying meaning and key details." },
    { name: "Detect Context", desc: "Identifies destination, formality, and audience." },
    { name: "Transform", desc: "Generates formatted, ready-to-use writing." }
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
        <div className="section-title-wrap">
          <span className="badge">Workflow</span>
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
            gap: "20px",
            marginBottom: "32px"
          }}
        >
          {mainSteps.map((step) => (
            <div
              key={step.num}
              className="card-premium"
              style={{
                background: "#ffffff",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                border: "1px solid #e5e5e5",
                borderRadius: "8px"
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "6px",
                  background: "#111111",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.95rem",
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
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#111111",
                  margin: 0
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "#666666",
                  margin: 0
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Technical Pipeline Toggle */}
        <div style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto" }}>
          <button
            type="button"
            onClick={() => setShowTechnicalPipeline(!showTechnicalPipeline)}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "6px",
              padding: "9px 18px",
              fontSize: "0.85rem",
              fontWeight: 500,
              color: "#111111",
              cursor: "pointer",
              transition: "background 0.15s ease"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
          >
            {showTechnicalPipeline ? "Hide Pipeline Architecture ↑" : "View Pipeline Architecture (5 Stages) ↓"}
          </button>

          {showTechnicalPipeline && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#fafafa",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "12px",
                textAlign: "left"
              }}
            >
              {pipelineStages.map((stage, idx) => (
                <div
                  key={stage.name}
                  style={{
                    background: "#ffffff",
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#666666", fontWeight: 700 }}>
                    Stage 0{idx + 1}
                  </span>
                  <strong style={{ display: "block", fontSize: "0.875rem", color: "#111111", marginTop: "2px" }}>
                    {stage.name}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#666666", lineHeight: 1.4, display: "block", marginTop: "4px" }}>
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
