import React from "react";

export const MeetingCompanionLanding: React.FC = () => {
  const upcomingCapabilities = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      ),
      title: "Automated Meeting Summaries",
      desc: "Structured overviews distilling conversations into clear, readable notes."
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      title: "Multilingual Understanding",
      desc: "Follow discussions where team members converse and switch across multiple languages."
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      title: "Action Items & Decisions",
      desc: "Identify key outcomes and extract assigned follow-ups automatically."
    }
  ];

  return (
    <section
      id="meeting-companion"
      className="section-spacing"
      style={{
        background: "#ffffff",
        position: "relative"
      }}
    >
      <div className="container" style={{ maxWidth: "860px" }}>
        <div className="section-title-wrap">
          <span className="badge">Feature Preview</span>
          <h2>Meeting Notes & Summaries</h2>
          <p>
            VoxFlow Meeting Companion is in active preview to help capture browser-based audio
            and produce clear transcripts, decisions, and action items.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px"
          }}
        >
          {upcomingCapabilities.map((item) => (
            <div
              key={item.title}
              className="card-premium"
              style={{
                background: "#ffffff",
                padding: "24px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                border: "1px solid #e5e5e5",
                borderRadius: "8px"
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "6px",
                  background: "#fafafa",
                  border: "1px solid #e5e5e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {item.icon}
              </div>

              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#111111",
                  margin: 0
                }}
              >
                {item.title}
              </h3>

              <p
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.55,
                  color: "#666666",
                  margin: 0
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <a
            href="#/meetings"
            className="btn-secondary"
            style={{ fontSize: "0.875rem", padding: "10px 20px" }}
          >
            Open Meeting Workspace →
          </a>
        </div>
      </div>
    </section>
  );
};
