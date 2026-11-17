import React from "react";
import { useAuth } from "../lib/authContext";

interface HeroProps {
  onOpenBetaModal?: () => void;
  onScrollToDemo: () => void;
  onGetExtension?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenBetaModal: _onOpenBetaModal,
  onScrollToDemo,
  onGetExtension
}) => {
  const { user } = useAuth();

  const handleScrollToHowItWorks = () => {
    const el = document.querySelector("#how-it-works");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      onScrollToDemo();
    }
  };

  const handleGetExtensionClick = () => {
    if (onGetExtension) {
      onGetExtension();
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
            Speak it. Get polished text.
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
            Turn your speech into clear, polished text with context-aware AI voice typing. Dictate emails, documents, and messages across languages, and generate automated AI meeting summaries in your browser.
          </p>

          {/* Action CTAs */}
          <div
            className="hero-cta-container"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              marginBottom: "36px"
            }}
          >
            <div
              className="hero-buttons-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "12px"
              }}
            >
              {user ? (
                <a
                  href="#/meetings"
                  className="btn-primary hero-primary-btn"
                  style={{
                    padding: "14px 30px",
                    fontSize: "1rem",
                    fontWeight: 600,
                    textDecoration: "none"
                  }}
                  aria-label="Open your VoxFlow Dashboard"
                >
                  Open Dashboard →
                </a>
              ) : (
                <a
                  href="#/signup"
                  className="btn-primary hero-primary-btn"
                  style={{
                    padding: "14px 30px",
                    fontSize: "1rem",
                    fontWeight: 600,
                    textDecoration: "none"
                  }}
                  aria-label="Get Started Free with VoxFlow"
                >
                  Get Started Free →
                </a>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={onScrollToDemo}
                style={{
                  padding: "14px 24px",
                  fontSize: "0.95rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                aria-label="Scroll to test the interactive voice demo"
              >
                <span aria-hidden="true">🎙️</span>
                <span>Try the Demo</span>
              </button>
            </div>

            {/* Sub-CTA reassurance */}
            <div
              style={{
                fontSize: "0.8125rem",
                color: "#666666",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "8px"
              }}
            >
              <span style={{ fontWeight: 500, color: "#111111" }}>Free plan available.</span>
              <span>No credit card needed.</span>
              <span style={{ color: "#d4d4d4" }} aria-hidden="true">•</span>
              <span>Includes 100 voice requests & 30 min transcription / mo</span>
            </div>

            {/* Non-competing subtle tertiary actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "20px",
                paddingTop: "4px"
              }}
            >
              <button
                type="button"
                id="hero-get-extension-btn"
                onClick={handleGetExtensionClick}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "6px 10px",
                  fontSize: "0.85rem",
                  color: "#666666",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "color 0.15s ease"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                aria-label="Get the VoxFlow Chrome extension"
              >
                <span aria-hidden="true">🧩</span>
                <span>Get Our Extension</span>
              </button>

              <button
                type="button"
                onClick={handleScrollToHowItWorks}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "6px 10px",
                  fontSize: "0.85rem",
                  color: "#666666",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "color 0.15s ease"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                aria-label="See how VoxFlow works"
              >
                <span>How It Works</span>
                <span aria-hidden="true">↓</span>
              </button>
            </div>
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
