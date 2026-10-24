import React from "react";
import { useAuth } from "../lib/authContext";

interface FinalCTAProps {
  onOpenBetaModal?: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onOpenBetaModal: _onOpenBetaModal }) => {
  const { user } = useAuth();

  return (
    <section
      id="cta"
      className="section-spacing"
      style={{
        background: "#111111",
        color: "#ffffff",
        textAlign: "center",
        position: "relative"
      }}
    >
      <div className="container" style={{ maxWidth: "780px" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#999999",
            marginBottom: "16px"
          }}
        >
          Get Started Today
        </span>

        <h2
          style={{
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            marginBottom: "16px",
            lineHeight: 1.2
          }}
        >
          Start writing at the speed of thought.
        </h2>

        <p
          style={{
            fontSize: "clamp(1rem, 1.8vw, 1.15rem)",
            lineHeight: 1.6,
            color: "#a3a3a3",
            maxWidth: "600px",
            margin: "0 auto 36px auto"
          }}
        >
          Turn natural speech into clear, context-aware text across your email, documents, and web applications.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "24px"
          }}
        >
          {user ? (
            <a
              href="#/meetings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "13px 28px",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#111111",
                background: "#ffffff",
                borderRadius: "6px",
                textDecoration: "none",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              Open Dashboard →
            </a>
          ) : (
            <a
              href="#/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "13px 28px",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#111111",
                background: "#ffffff",
                borderRadius: "6px",
                textDecoration: "none",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              Get Started Free →
            </a>
          )}

          <a
            href="#demo"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#demo")?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 24px",
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "transparent",
              border: "1px solid #404040",
              borderRadius: "6px",
              textDecoration: "none",
              transition: "border-color 0.15s ease, background 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#ffffff";
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#404040";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Try the Voice Demo
          </a>
        </div>

        <div
          style={{
            fontSize: "0.8125rem",
            color: "#737373",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <span>✓ Free plan includes 30 min / month</span>
          <span>✓ No credit card required</span>
          <span>✓ Chrome browser support</span>
        </div>
      </div>
    </section>
  );
};
