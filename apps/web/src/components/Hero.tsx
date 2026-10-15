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
        paddingTop: "64px",
        paddingBottom: "80px",
        background: "#ffffff"
      }}
    >
      <div className="container">
        {/* Hero Top Copy */}
        <div
          style={{
            textAlign: "center",
            maxWidth: "760px",
            margin: "0 auto 48px auto"
          }}
        >
          {/* Product Badge */}
          <div style={{ display: "inline-block", marginBottom: "20px" }}>
            <span className="badge">
              AI Voice Typing for Web Browsers
            </span>
          </div>

          {/* Single H1 per page */}
          <h1
            style={{
              fontSize: "clamp(2.4rem, 5vw, 3.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.12,
              marginBottom: "20px",
              color: "#111111"
            }}
          >
            Speak naturally. Write everywhere.
          </h1>

          {/* Supporting Copy */}
          <p
            style={{
              fontSize: "clamp(1.05rem, 1.8vw, 1.2rem)",
              lineHeight: 1.6,
              color: "#666666",
              maxWidth: "620px",
              margin: "0 auto 32px auto"
            }}
          >
            Convert natural speech into clear, structured text in your preferred language.
            VoxFlow adapts to your context so you can write across the web without typing every word.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "36px"
            }}
          >
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenBetaModal}
              style={{ padding: "12px 24px", fontSize: "0.9375rem" }}
            >
              Get Started
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleScrollToHowItWorks}
              style={{ padding: "12px 22px", fontSize: "0.9375rem" }}
            >
              How It Works
            </button>
          </div>

          {/* Value Points */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "24px",
              fontSize: "0.875rem",
              color: "#666666"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Runs in your browser</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Multilingual speech & code-switching</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Context-aware text formatting</span>
            </div>
          </div>
        </div>

        {/* Focused Product Visual: Clean Desktop Browser Experience */}
        <div
          style={{
            maxWidth: "920px",
            margin: "0 auto",
            borderRadius: "8px",
            border: "1px solid #e5e5e5",
            background: "#ffffff",
            overflow: "hidden"
          }}
        >
          {/* Browser Window Titlebar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "#fafafa",
              borderBottom: "1px solid #e5e5e5"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#d4d4d4" }} />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#d4d4d4" }} />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#d4d4d4" }} />
            </div>

            {/* Address bar */}
            <div
              style={{
                flex: "1",
                maxWidth: "380px",
                margin: "0 12px",
                background: "#ffffff",
                padding: "4px 10px",
                borderRadius: "4px",
                border: "1px solid #e5e5e5",
                fontSize: "0.75rem",
                color: "#666666",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                mail.google.com/mail/u/0/#inbox/compose
              </span>
            </div>

            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#111111",
                background: "#f5f5f5",
                padding: "3px 8px",
                borderRadius: "4px",
                border: "1px solid #e5e5e5"
              }}
            >
              VoxFlow Active
            </div>
          </div>

          {/* Visual Workspace Content */}
          <div
            style={{
              padding: "24px",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            {/* Email Header Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid #e5e5e5", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}>
                <span style={{ color: "#666666", width: "40px" }}>To:</span>
                <span style={{ color: "#111111", fontWeight: 500 }}>sarah@company.com</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}>
                <span style={{ color: "#666666", width: "40px" }}>Subject:</span>
                <span style={{ color: "#111111", fontWeight: 500 }}>Q3 Retention Report & Slide 8 Review</span>
              </div>
            </div>

            {/* Spoken Voice Input vs Transformed Output */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                padding: "8px 0"
              }}
            >
              {/* Spoken Input */}
              <div
                style={{
                  background: "#fafafa",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#666666" }}>
                  What You Speak Naturally
                </span>
                <p style={{ margin: 0, fontSize: "0.9375rem", color: "#666666", lineHeight: 1.6, fontStyle: "italic" }}>
                  "Sarah ko bolo q3 metrics are looking great, send over the slide eight review by tomorrow morning so we can sync."
                </p>
                <span style={{ fontSize: "0.75rem", color: "#666666" }}>
                  Language: Hindi + English (Hinglish)
                </span>
              </div>

              {/* Transformed Output */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #111111",
                  borderRadius: "6px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111111" }}>
                  What VoxFlow Writes
                </span>
                <p style={{ margin: 0, fontSize: "0.9375rem", color: "#111111", lineHeight: 1.6, fontWeight: 500 }}>
                  "Hi Sarah, The Q3 retention metrics look great. Could you please send over your review of Slide 8 by tomorrow morning ahead of our sync?"
                </p>
                <span style={{ fontSize: "0.75rem", color: "#666666", fontWeight: 500 }}>
                  Polished for email • Professional tone
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
