import React from "react";

interface PricingProps {
  onOpenBetaModal: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ onOpenBetaModal }) => {
  return (
    <section id="pricing" className="section-spacing">
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge badge-glow">Access & Pricing</span>
          <h2>Free During Public Beta</h2>
          <p>
            We are currently in active public beta testing. Experience all core
            features today with early access privileges.
          </p>
        </div>

        {/* Single Transparent Beta Access Card */}
        <div
          className="card-premium"
          style={{
            maxWidth: "520px",
            margin: "0 auto",
            padding: "44px 36px",
            textAlign: "center",
            background: "#ffffff",
            position: "relative",
            border: "1px solid rgba(126, 20, 255, 0.25)",
            boxShadow:
              "0 20px 45px -10px rgba(126, 20, 255, 0.12), 0 4px 16px rgba(15, 23, 42, 0.04)"
          }}
        >
          {/* Badge */}
          <div style={{ marginBottom: "16px" }}>
            <span className="badge badge-emerald">Early Access Beta Pass</span>
          </div>

          <h3
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: "8px"
            }}
          >
            VoxFlow Public Beta
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: "6px",
              margin: "20px 0"
            }}
          >
            <span
              style={{
                fontSize: "3.25rem",
                fontWeight: 800,
                color: "#7e14ff",
                fontFamily: "var(--font-heading)"
              }}
            >
              $0
            </span>
            <span style={{ fontSize: "1rem", color: "#64748b" }}>
              / free during beta
            </span>
          </div>

          <p
            style={{
              fontSize: "0.9375rem",
              color: "#64748b",
              lineHeight: 1.6,
              marginBottom: "28px"
            }}
          >
            Pricing and commercial subscription tiers will be announced soon as
            we approach general availability. Beta testers receive priority access.
          </p>

          {/* Included Features List */}
          <div
            style={{
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "32px",
              background: "#faf9fd",
              padding: "20px",
              borderRadius: "16px",
              border: "1px solid #f1edf8"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#334155" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>Full microphone voice-to-text dictation</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#334155" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>Browser-tab audio recording & processing</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#334155" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>5-step AI pipeline (meaning, context, tone)</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#334155" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>50+ languages + mixed conversational modes</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#334155" }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
              <span>One-click input field insertion</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={onOpenBetaModal}
            style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
          >
            <span>Request Early Beta Access</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
};
