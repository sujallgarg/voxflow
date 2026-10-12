import React from "react";

export const MeetingCompanionLanding: React.FC = () => {
  const upcomingCapabilities = [
    {
      icon: "📋",
      title: "Automated Meeting Summaries",
      desc: "Structured overviews distilling long discussions into concise executive summaries."
    },
    {
      icon: "🌐",
      title: "Multilingual Understanding",
      desc: "Follow discussions where participants speak and switch between multiple languages."
    },
    {
      icon: "✓",
      title: "Action Items & Decisions",
      desc: "Identify decisions made and extract actionable follow-ups with assigned owners."
    }
  ];

  return (
    <section
      id="meeting-companion"
      className="section-spacing"
      style={{
        background: "linear-gradient(180deg, #fbf9fe 0%, #f6effe 50%, #fbf9fe 100%)",
        position: "relative"
      }}
    >
      <div className="container" style={{ maxWidth: "900px" }}>
        <div className="section-title-wrap">
          <span className="badge badge-glow">Planned Feature • Coming Soon</span>
          <h2>Multilingual Meeting Notes</h2>
          <p>
            We are currently developing VoxFlow Meeting Companion to help international teams
            capture conversations across languages and leave every sync with clear notes, decisions, and action items.
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
                border: "1px solid var(--border-subtle)"
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#faf8ff",
                  border: "1px solid #ece5f8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px"
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
                  fontSize: "0.875rem",
                  lineHeight: 1.55,
                  color: "#64748b",
                  margin: 0
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "36px" }}>
          <a
            href="#/meetings"
            className="btn-outline"
            style={{ fontSize: "0.9rem", padding: "11px 24px" }}
          >
            Launch Meeting Workspace (Local Beta) →
          </a>
        </div>
      </div>
    </section>
  );
};
