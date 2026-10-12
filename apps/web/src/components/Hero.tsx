import React from "react";

interface HeroProps {
  onOpenBetaModal: () => void;
  onScrollToDemo: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBetaModal, onScrollToDemo }) => {
  const handleScrollToHowItWorks = () => {
    const el = document.querySelector("#how-it-works");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      onScrollToDemo();
    }
  };

  return (
    <section
      style={{
        position: "relative",
        paddingTop: "56px",
        paddingBottom: "80px",
        overflow: "hidden"
      }}
    >
      <div className="container">
        {/* Hero Top Copy */}
        <div
          style={{
            textAlign: "center",
            maxWidth: "800px",
            margin: "0 auto 44px auto"
          }}
        >
          {/* Subtle Product Badge */}
          <div style={{ display: "inline-block", marginBottom: "18px" }}>
            <span className="badge badge-glow">
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block"
                }}
              />
              AI Voice Typing for Modern Browsers
            </span>
          </div>

          {/* Single H1 per page */}
          <h1
            style={{
              fontSize: "clamp(2.4rem, 5vw, 3.85rem)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.14,
              marginBottom: "20px",
              color: "#0f172a"
            }}
          >
            Speak Naturally.{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7e14ff 0%, #9333ea 50%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}
            >
              Write Everywhere.
            </span>
          </h1>

          {/* Supporting Copy */}
          <p
            style={{
              fontSize: "clamp(1.05rem, 1.8vw, 1.2rem)",
              lineHeight: 1.6,
              color: "#475569",
              maxWidth: "660px",
              margin: "0 auto 32px auto"
            }}
          >
            Turn your speech into clear, context-aware text in your preferred language.
            VoxFlow helps you write across the web without typing every word.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "32px"
            }}
          >
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenBetaModal}
              style={{ padding: "14px 28px", fontSize: "1rem" }}
            >
              Get Early Access
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleScrollToHowItWorks}
              style={{ padding: "14px 26px", fontSize: "1rem" }}
            >
              See How It Works ↓
            </button>
          </div>

          {/* Key Value Points */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "24px",
              fontSize: "0.85rem",
              color: "#64748b"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>Works directly in your browser</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>Multilingual & mixed-language speech</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>Polished, formatted text</span>
            </div>
          </div>
        </div>

        {/* Single Focused Product Visual: Clean Browser Experience */}
        <div
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            borderRadius: "20px",
            border: "1px solid rgba(126, 20, 255, 0.15)",
            background: "#ffffff",
            boxShadow:
              "0 20px 50px -15px rgba(126, 20, 255, 0.1), 0 6px 20px -5px rgba(15, 23, 42, 0.05)",
            overflow: "hidden"
          }}
        >
          {/* Browser Window Titlebar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              background: "#faf9fd",
              borderBottom: "1px solid #ece7f6"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f87171" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fbbf24" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#34d399" }} />
            </div>

            {/* Address bar */}
            <div
              style={{
                flex: "1",
                maxWidth: "420px",
                margin: "0 14px",
                background: "#ffffff",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e0ed",
                fontSize: "0.8rem",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>🔒</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                mail.google.com/mail/u/0/#inbox/compose
              </span>
            </div>

            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#7e14ff",
                background: "#f3e8ff",
                padding: "3px 8px",
                borderRadius: "6px"
              }}
            >
              VoxFlow Active
            </div>
          </div>

          {/* Visual Workspace Content */}
          <div
            style={{
              padding: "24px 28px",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            {/* Email Header Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid #f1edf8", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}>
                <span style={{ color: "#64748b", width: "40px" }}>To:</span>
                <span style={{ color: "#0f172a", fontWeight: 500 }}>sarah@company.com</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}>
                <span style={{ color: "#64748b", width: "40px" }}>Subject:</span>
                <span style={{ color: "#0f172a", fontWeight: 500 }}>Q3 Retention Report & Slide 8 Review</span>
              </div>
            </div>

            {/* Spoken Voice Input vs Transformed Output */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "18px",
                padding: "16px 0"
              }}
            >
              {/* Spoken Input */}
              <div
                style={{
                  background: "#faf9fd",
                  border: "1px solid #ece5f8",
                  borderRadius: "14px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>🎙</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#7e14ff" }}>
                    What You Speak Naturally
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.925rem", color: "#475569", lineHeight: 1.6, fontStyle: "italic" }}>
                  "Sarah ko bolo q3 metrics are looking great, send over the slide eight review by tomorrow morning so we can sync."
                </p>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Language: Hindi + English (Hinglish)
                </span>
              </div>

              {/* Transformed Output */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(126, 20, 255, 0.25)",
                  borderRadius: "14px",
                  padding: "18px",
                  boxShadow: "0 4px 14px rgba(126, 20, 255, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>✨</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#059669" }}>
                    What VoxFlow Writes
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.925rem", color: "#0f172a", lineHeight: 1.6, fontWeight: 500 }}>
                  "Hi Sarah, The Q3 retention metrics look great. Could you please send over your review of Slide 8 by tomorrow morning ahead of our sync?"
                </p>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>
                  ✓ Polished, professional tone • Formatted for email
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
