import React from "react";
import { useAuth } from "../lib/authContext";

interface HeroProps {
  onOpenBetaModal?: () => void;
  onScrollToDemo: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBetaModal: _onOpenBetaModal, onScrollToDemo }) => {
  const { user } = useAuth();

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
        paddingTop: "72px",
        paddingBottom: "64px",
        background: "#ffffff"
      }}
    >
      <div className="container">
        <div
          style={{
            textAlign: "center",
            maxWidth: "840px",
            margin: "0 auto"
          }}
        >
          {/* Product Badge */}
          <div style={{ display: "inline-block", marginBottom: "20px" }}>
            <span className="badge">
              AI Voice Typing & Meeting Intelligence
            </span>
          </div>

          {/* Page H1 */}
          <h1
            style={{
              fontSize: "clamp(2.5rem, 5.5vw, 4rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              marginBottom: "20px",
              color: "#111111"
            }}
          >
            Speak naturally. Write everywhere.
          </h1>

          {/* Supporting Copy */}
          <p
            style={{
              fontSize: "clamp(1.0625rem, 2vw, 1.25rem)",
              lineHeight: 1.6,
              color: "#555555",
              maxWidth: "680px",
              margin: "0 auto 36px auto"
            }}
          >
            VoxFlow turns your spoken words into polished, context-aware text in your preferred language.
            Speak naturally, switch languages mid-sentence, and draft effortlessly across your everyday web workflow.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "40px"
            }}
          >
            {user ? (
              <a
                href="#/meetings"
                className="btn-primary"
                style={{
                  padding: "13px 26px",
                  fontSize: "0.95rem",
                  textDecoration: "none"
                }}
              >
                Open Dashboard →
              </a>
            ) : (
              <a
                href="#/signup"
                className="btn-primary"
                style={{
                  padding: "13px 26px",
                  fontSize: "0.95rem",
                  textDecoration: "none"
                }}
              >
                Get Started Free →
              </a>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={onScrollToDemo}
              style={{
                padding: "13px 24px",
                fontSize: "0.95rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span>🎙️</span>
              <span>Try the Demo</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleScrollToHowItWorks}
              style={{
                padding: "13px 22px",
                fontSize: "0.95rem"
              }}
            >
              How It Works
            </button>
          </div>

          {/* Three Concise Benefits */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "28px",
              fontSize: "0.9rem",
              color: "#666666",
              paddingTop: "12px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Multilingual input & code-switching</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Natural phrasing without rigid dictation</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>3x faster writing across any web app</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
