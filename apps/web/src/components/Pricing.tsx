import React, { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { getCurrentUser } from "../lib/userStore";
import { useSubscription } from "../lib/subscriptionContext";

interface PricingProps {
  onOpenBetaModal?: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ onOpenBetaModal: _onOpenBetaModal }) => {
  const { user } = useAuth();
  const currentUser = getCurrentUser();
  const userId = user?.id || currentUser.id;

  const { entitlements } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (checkoutLoading) return; // Prevent double clicks

    if (!user) {
      window.location.hash = "#/login?returnTo=" + encodeURIComponent("#/pricing");
      return;
    }

    if (entitlements?.isPremium) {
      window.location.hash = "#/billing";
      return;
    }

    try {
      setCheckoutLoading(true);
      setErrorMessage(null);
      const res = await api.createCheckoutSession("premium_monthly", userId);
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      console.error("Checkout initiation error:", err);
      if (err.code === "ALREADY_SUBSCRIBED") {
        setErrorMessage("You already have an active subscription. Redirecting to billing...");
        setTimeout(() => {
          window.location.hash = "#/billing";
        }, 1500);
      } else {
        setErrorMessage(err.message || "Failed to start checkout. Please try again.");
      }
      setCheckoutLoading(false);
    }
  };

  return (
    <section id="pricing" className="section-spacing" style={{ background: "#fafafa" }}>
      <div className="container">
        <div className="section-title-wrap" style={{ textAlign: "center", marginBottom: "48px" }}>
          <span className="badge">Plans & Pricing</span>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, color: "#111111", marginBottom: "12px" }}>
            Simple, Transparent Pricing
          </h2>
          <p style={{ fontSize: "1.0625rem", color: "#666666", maxWidth: "600px", margin: "0 auto" }}>
            Start with our generous free tier or upgrade to Premium for expanded intelligence, high quotas, and priority processing.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              maxWidth: "840px",
              margin: "0 auto 28px",
              padding: "14px 20px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#991b1b",
              fontSize: "0.875rem",
              textAlign: "center"
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "28px",
            maxWidth: "1120px",
            margin: "0 auto 40px"
          }}
        >
          {/* PLAN 1: FREE */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              padding: "36px 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative"
            }}
          >
            <div>
              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#666666"
                  }}
                >
                  Essential Tier
                </span>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "6px" }}>
                Free
              </h3>

              <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.5, minHeight: "42px" }}>
                Essential voice dictation and basic meeting recording for personal use.
              </p>

              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "24px 0" }}>
                <span
                  style={{
                    fontSize: "2.75rem",
                    fontWeight: 700,
                    color: "#111111",
                    fontFamily: "var(--font-heading)"
                  }}
                >
                  $0
                </span>
                <span style={{ fontSize: "0.9375rem", color: "#666666" }}>/ month</span>
              </div>

              <div
                style={{
                  borderTop: "1px solid #eeeeee",
                  paddingTop: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "32px",
                  fontSize: "0.875rem",
                  color: "#333333"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>30 minutes</strong> voice transcription / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>100 requests</strong> voice typing / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>50 requests</strong> AI text correction / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>3 meetings</strong> & <strong>3 AI summaries</strong> / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>7 days</strong> meeting history retention</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#999999" }}>
                  <span>—</span>
                  <span>Premium badge not included</span>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    window.location.hash = "#/meetings";
                  } else {
                    window.location.hash = "#/signup";
                  }
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  background: "#ffffff",
                  color: "#111111",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#111111")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
              >
                {!entitlements?.isPremium && user ? "Current Active Plan" : "Get Started Free"}
              </button>
            </div>
          </div>

          {/* PLAN 2: PRO */}
          <div
            style={{
              background: "#ffffff",
              border: "2px solid #111111",
              borderRadius: "8px",
              padding: "36px 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)"
            }}
          >
            {/* Badge */}
            <div
              style={{
                position: "absolute",
                top: "-12px",
                right: "24px",
                background: "#111111",
                color: "#ffffff",
                padding: "3px 12px",
                borderRadius: "12px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase"
              }}
            >
              Popular
            </div>

            <div>
              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#111111"
                  }}
                >
                  Pro Tier
                </span>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "6px" }}>
                Pro
              </h3>

              <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.5, minHeight: "42px" }}>
                Deep voice intelligence, expanded quotas, priority processing, and active Pro badge.
              </p>

              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "24px 0" }}>
                <span
                  style={{
                    fontSize: "2.75rem",
                    fontWeight: 700,
                    color: "#111111",
                    fontFamily: "var(--font-heading)"
                  }}
                >
                  $9
                </span>
                <span style={{ fontSize: "0.9375rem", color: "#666666" }}>USD / month</span>
              </div>

              <div
                style={{
                  borderTop: "1px solid #eeeeee",
                  paddingTop: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "32px",
                  fontSize: "0.875rem",
                  color: "#111111"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>300 minutes</strong> voice transcription / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>1,000 requests</strong> voice typing / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>500 requests</strong> AI text correction / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>25 meetings</strong> & <strong>25 AI summaries</strong> / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span>Fair-use retention (no fixed time limit)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>Active Pro Badge</strong> & priority processing</span>
                </div>
              </div>
            </div>

            <div>
              {entitlements?.isPremium ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = "#/billing";
                  }}
                  style={{
                    width: "100%",
                    padding: "13px",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    background: "#f0fdf4",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  ✓ Current Plan — Manage Billing
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  style={{
                    width: "100%",
                    padding: "13px",
                    fontSize: "0.9375rem",
                    opacity: checkoutLoading ? 0.7 : 1,
                    cursor: checkoutLoading ? "wait" : "pointer"
                  }}
                >
                  {checkoutLoading ? "Connecting to Checkout..." : "Upgrade to Pro — $9/mo"}
                </button>
              )}
            </div>
          </div>

          {/* PLAN 3: BUSINESS (COMING SOON) */}
          <div
            style={{
              background: "#fafafa",
              border: "1px dashed #cccccc",
              borderRadius: "8px",
              padding: "36px 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              opacity: 0.92
            }}
          >
            {/* Status Badge */}
            <div
              style={{
                position: "absolute",
                top: "-12px",
                right: "24px",
                background: "#737373",
                color: "#ffffff",
                padding: "3px 12px",
                borderRadius: "12px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase"
              }}
            >
              Coming Soon
            </div>

            <div>
              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#737373"
                  }}
                >
                  Team & Enterprise
                </span>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#404040", marginBottom: "6px" }}>
                Business
              </h3>

              <p style={{ fontSize: "0.875rem", color: "#737373", lineHeight: 1.5, minHeight: "42px" }}>
                High-capacity shared workspaces, team seat management, and unified summaries.
              </p>

              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "24px 0" }}>
                <span
                  style={{
                    fontSize: "2.75rem",
                    fontWeight: 700,
                    color: "#404040",
                    fontFamily: "var(--font-heading)"
                  }}
                >
                  $
                </span>
                <span style={{ fontSize: "0.9375rem", color: "#737373" }}>USD / month</span>
              </div>

              <div
                style={{
                  borderTop: "1px solid #e5e5e5",
                  paddingTop: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "32px",
                  fontSize: "0.875rem",
                  color: "#525252"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span><strong>Planned 1,000 min</strong> transcription / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span><strong>Planned 3,000 requests</strong> voice typing / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span><strong>Planned 1,500 requests</strong> AI text correction</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span><strong>Planned 100 meetings</strong> & summaries / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span><strong>Planned 5 team seats</strong> included</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span>Shared meeting workspace (Planned)</span>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                disabled
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  background: "#e5e5e5",
                  color: "#737373",
                  border: "1px solid #d4d4d4",
                  borderRadius: "6px",
                  cursor: "not-allowed"
                }}
              >
                Not Available Yet
              </button>
            </div>
          </div>
        </div>

        {/* Billing Policy Guarantees */}
        <div
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
            textAlign: "center"
          }}
        >
          <div style={{ padding: "16px", background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: "6px" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111111", marginBottom: "4px" }}>
              Monthly Renewal
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "#666666", margin: 0 }}>
              $9 billed monthly in USD. Renews every 30 days automatically.
            </p>
          </div>

          <div style={{ padding: "16px", background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: "6px" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111111", marginBottom: "4px" }}>
              Cancel Anytime
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "#666666", margin: 0 }}>
              Cancel in one click. You retain Premium access until the end of the billing period.
            </p>
          </div>

          <div style={{ padding: "16px", background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: "6px" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111111", marginBottom: "4px" }}>
              Secure Payments
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "#666666", margin: 0 }}>
              Encrypted provider-hosted checkout. Card numbers are never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
