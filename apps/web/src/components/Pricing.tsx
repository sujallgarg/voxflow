import React from "react";

interface PricingProps {
  onOpenBetaModal: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ onOpenBetaModal }) => {
  return (
    <section id="pricing" className="section-spacing">
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge">Access & Pricing</span>
          <h2>Free During Public Beta</h2>
          <p>
            VoxFlow is currently in open public beta. All voice input capabilities are free to use.
          </p>
        </div>

        {/* Transparent Beta Access Card */}
        <div
          className="card-premium"
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "40px 32px",
            textAlign: "center",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "8px"
          }}
        >
          <div style={{ marginBottom: "14px" }}>
            <span className="badge">Public Beta Pass</span>
          </div>

          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#111111",
              marginBottom: "8px"
            }}
          >
            VoxFlow Early Access
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: "6px",
              margin: "18px 0"
            }}
          >
            <span
              style={{
                fontSize: "3rem",
                fontWeight: 700,
                color: "#111111",
                fontFamily: "var(--font-heading)"
              }}
            >
              $0
            </span>
            <span style={{ fontSize: "0.9375rem", color: "#666666" }}>
              / free during beta
            </span>
          </div>

          <p
            style={{
              fontSize: "0.9375rem",
              color: "#666666",
              lineHeight: 1.6,
              marginBottom: "28px"
            }}
          >
            Commercial plans will be announced prior to general release. Beta participants receive uninterrupted access and priority updates.
          </p>

          {/* Included Features List */}
          <div
            style={{
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "28px",
              background: "#fafafa",
              padding: "18px 20px",
              borderRadius: "6px",
              border: "1px solid #e5e5e5"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#111111" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Microphone voice-to-text dictation</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#111111" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Multilingual speech & natural code-switching</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#111111" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Contextual tone and grammar refinement</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#111111" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Direct input field insertion across supported sites</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem", color: "#111111" }}>
              <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
              <span>Meeting notes & companion preview access</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={onOpenBetaModal}
            style={{ width: "100%", padding: "13px", fontSize: "0.9375rem" }}
          >
            Request Beta Access
          </button>
        </div>
      </div>
    </section>
  );
};
