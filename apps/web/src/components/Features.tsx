import React from "react";

export const Features: React.FC = () => {
  const coreFeatures = [
    {
      id: "voice-to-text",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7e14ff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ),
      title: "Voice-to-Text",
      description:
        "High-accuracy speech transcription directly from your microphone into clean text without manual typing."
    },
    {
      id: "multilingual-input",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7e14ff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      title: "Multilingual Input",
      description:
        "Speak in your preferred language or naturally switch languages mid-sentence with native code-switching support."
    },
    {
      id: "context-aware",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7e14ff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      title: "Context-Aware Writing",
      description:
        "Transforms spoken intent into structured sentences with correct grammar, punctuation, and appropriate tone."
    },
    {
      id: "text-insertion",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7e14ff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: "Text Insertion into Supported Websites",
      description:
        "Easily draft messages, emails, documents, and form replies across the browser pages you use every day."
    }
  ];

  return (
    <section id="features" className="section-spacing">
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge badge-glow">Core Features</span>
          <h2>Everything You Need to Voice-Type Clearly</h2>
          <p>
            Designed to turn everyday spoken thoughts into well-structured, ready-to-use writing.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px"
          }}
        >
          {coreFeatures.map((item) => (
            <div
              key={item.id}
              className="card-premium"
              style={{
                background: "#ffffff",
                padding: "26px 22px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#faf8ff",
                  border: "1px solid #ece5f8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {item.icon}
              </div>

              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0
                }}
              >
                {item.title}
              </h3>

              <p
                style={{
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  color: "#64748b",
                  margin: 0
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
