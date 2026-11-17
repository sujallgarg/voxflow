import React, { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { getCurrentUser } from "../lib/userStore";
import { useSubscription } from "../lib/subscriptionContext";
import { PLAN_CONFIGS } from "@voxflow/shared";

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

  const freeConfig = PLAN_CONFIGS.free;
  const proConfig = PLAN_CONFIGS.premium_monthly;

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
        {/* Section Title */}
        <div className="section-title-wrap" style={{ textAlign: "center", marginBottom: "48px" }}>
          <span className="badge">Plans & Pricing</span>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, color: "#111111", marginBottom: "12px" }}>
            Start free, Pro is $9/mo
          </h2>
          <p style={{ fontSize: "1.0625rem", color: "#666666", maxWidth: "600px", margin: "0 auto" }}>
            Start for free to streamline your daily typing or upgrade to Pro for expanded transcription, higher quotas, and meeting intelligence.
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

        {/* 3 Visually Aligned Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "24px",
            maxWidth: "1120px",
            margin: "0 auto"
          }}
        >
          {/* CARD 1: FREE */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "12px",
              padding: "clamp(24px, 4vw, 36px) clamp(16px, 3.5vw, 28px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
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
                  Starter
                </span>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "6px" }}>
                Free
              </h3>

              <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.5, minHeight: "42px", margin: 0 }}>
                Essential voice dictation and basic meeting recording for individual users.
              </p>

              {/* Price Area */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "24px", marginBottom: "8px" }}>
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
              <div style={{ fontSize: "0.8125rem", color: "#166534", fontWeight: 500, marginBottom: "20px" }}>
                ✓ No credit card required
              </div>

              {/* Feature List */}
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
                  <span><strong>{freeConfig.limits.transcriptionMinutes} minutes</strong> audio transcription / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{freeConfig.limits.voiceTypingRequests} requests</strong> voice typing / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{freeConfig.limits.textCorrectionRequests} requests</strong> AI text correction / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{freeConfig.limits.monthlyMeetings} meetings</strong> & <strong>{freeConfig.limits.meetingSummaries} summaries</strong> / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{freeConfig.limits.historyRetentionDays} days</strong> meeting history retention</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#999999" }}>
                  <span>—</span>
                  <span>Standard processing queue</span>
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

          {/* CARD 2: PRO */}
          <div
            style={{
              background: "#ffffff",
              border: "2px solid #111111",
              borderRadius: "12px",
              padding: "clamp(24px, 4vw, 36px) clamp(16px, 3.5vw, 28px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              boxShadow: "0 6px 24px rgba(0, 0, 0, 0.06)"
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
                  Professional
                </span>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "6px" }}>
                Pro
              </h3>

              <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.5, minHeight: "42px", margin: 0 }}>
                High-volume voice intelligence, expanded quotas, priority processing, and active Pro badge.
              </p>

              {/* Price Area */}
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

              {/* Feature List */}
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
                  <span><strong>{proConfig.limits.transcriptionMinutes} minutes</strong> audio transcription / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{proConfig.limits.voiceTypingRequests.toLocaleString()} requests</strong> voice typing / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{proConfig.limits.textCorrectionRequests} requests</strong> AI text correction / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span><strong>{proConfig.limits.monthlyMeetings} meetings</strong> & <strong>{proConfig.limits.meetingSummaries} summaries</strong> / mo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#111111", fontWeight: 700 }}>✓</span>
                  <span>Fair-use meeting retention</span>
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

          {/* CARD 3: BUSINESS (COMING SOON) */}
          <div
            style={{
              background: "#ffffff",
              border: "1px dashed #d4d4d4",
              borderRadius: "12px",
              padding: "clamp(24px, 4vw, 36px) clamp(16px, 3.5vw, 28px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative"
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

              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "6px" }}>
                Business
              </h3>

              <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.5, minHeight: "42px", margin: 0 }}>
                High-capacity shared workspaces, team seat management, and unified analytics.
              </p>

              {/* Price Area: Clearly Display Coming Soon */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "24px 0" }}>
                <span
                  style={{
                    fontSize: "2.25rem",
                    fontWeight: 700,
                    color: "#737373",
                    fontFamily: "var(--font-heading)"
                  }}
                >
                  Coming Soon
                </span>
              </div>

              {/* Feature List */}
              <div
                style={{
                  borderTop: "1px solid #eeeeee",
                  paddingTop: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "32px",
                  fontSize: "0.875rem",
                  color: "#666666"
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
                  <span>Centralized team administration & billing</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#737373", fontWeight: 700 }}>•</span>
                  <span>Dedicated priority pipeline & SLA</span>
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
                  background: "#f5f5f5",
                  color: "#999999",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "not-allowed"
                }}
              >
                Plan In Development
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
