import React from "react";

interface RefundPolicyProps {
  onBackToHome: () => void;
}

export const RefundPolicy: React.FC<RefundPolicyProps> = ({ onBackToHome }) => {
  return (
    <div style={{ background: "#fbf9fe", minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div className="container" style={{ maxWidth: "860px", margin: "0 auto" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: "28px" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onBackToHome}
            style={{ fontSize: "0.875rem", padding: "8px 16px" }}
          >
            ← Back to Home
          </button>
        </div>

        {/* Legal Document Container */}
        <article
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
            padding: "48px 40px",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)"
          }}
        >
          {/* Header */}
          <header style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "24px", marginBottom: "32px" }}>
            <span className="badge badge-glow" style={{ marginBottom: "12px" }}>
              Legal Documentation
            </span>
            <h1
              style={{
                fontSize: "2.25rem",
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.2,
                marginBottom: "12px"
              }}
            >
              Refund and Cancellation Policy
            </h1>
            <p style={{ fontSize: "0.9375rem", color: "#64748b" }}>
              Last updated: October 15, 2026 | Status: Free Public Beta
            </p>
          </header>

          {/* Current Status Callout */}
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "10px",
              padding: "20px 24px",
              marginBottom: "32px",
              color: "#065f46"
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px", color: "#065f46" }}>
              Current Status: 100% Free Developer Preview ($0)
            </h2>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
              VoxFlow is currently offered free of charge during our developer preview and private beta phase. No credit card, bank details, or subscription payments are accepted or processed on this website. Because no monetary charges exist, refund requests are not applicable at this time.
            </p>
          </div>

          {/* Planned Commercial Framework */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              1. Upcoming Commercial Subscription Terms
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              When VoxFlow launches paid commercial tiers, the following customer-friendly cancellation and refund principles will govern all paid subscriptions:
            </p>
            <ul style={{ paddingLeft: "24px", color: "#475569", fontSize: "0.95rem", lineHeight: 1.7 }}>
              <li style={{ marginBottom: "10px" }}>
                <strong>No Surprise Billing:</strong> Free trials will never automatically convert to a paid subscription without prior notice and explicit confirmation.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Immediate Self-Service Cancellation:</strong> You will be able to cancel your subscription at any time via your account dashboard with a single click. Cancellation immediately stops future renewals.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Active Period Retention:</strong> When you cancel, you will retain full access to your plan until the end of your prepaid billing period.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Statutory Withdrawal Rights:</strong> In accordance with consumer protection directives (including EU/UK distance selling regulations and applicable local consumer laws), consumers will have a statutory 14-day right of withdrawal from initial subscription purchases.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Prorated Consideration for Technical Downtime:</strong> If a documented system outage prevents service delivery for an extended period, prorated credits or refunds will be issued upon support review.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              2. Billing Inquiries and Support
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7 }}>
              If you have any questions regarding future pricing or access tiers, please contact:
              <br />
              <strong style={{ color: "#0f172a" }}>VoxFlow Support</strong>
              <br />
              Email: <a href="mailto:support@voxflow.ai" style={{ color: "#4f46e5", fontWeight: 600 }}>support@voxflow.ai</a>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};
