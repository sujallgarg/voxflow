import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/authContext";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  limitReached?: string;
  featureKey?: "voice" | "meetings";
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  reason,
  limitReached,
  featureKey
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"new" | "early_renewal" | "topup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subData, setSubData] = useState<{ entitlements: any; subscription: any } | null>(null);

  useEffect(() => {
    if (isOpen && user?.id) {
      api
        .getSubscription(user.id)
        .then((data) => {
          setSubData(data);
        })
        .catch(() => {});
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const isPro = subData?.entitlements?.isPremium;
  const entitlements = subData?.entitlements;
  const subscription = subData?.subscription;

  const resetDate = entitlements?.resetDate
    ? new Date(entitlements.resetDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : entitlements?.expiresAt
      ? new Date(entitlements.expiresAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "next monthly cycle";

  const expiryDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : resetDate;

  // Feature breakdown
  const voiceBreakdown = entitlements?.voice;
  const meetingsBreakdown = entitlements?.meetings;

  const handleCheckout = async (action: "new" | "early_renewal" | "topup" = "new") => {
    if (!user) {
      window.location.hash = "#/login?returnTo=" + encodeURIComponent("#/pricing");
      onClose();
      return;
    }

    try {
      setLoading(true);
      setLoadingType(action);
      setError(null);
      const res = await api.createCheckoutSession("premium_monthly", user.id, action);
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to initiate checkout. Please try again.");
      setLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 100
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e5e5e5",
          padding: "32px 28px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: isPro ? "#fef3c7" : "#111111",
              color: isPro ? "#92400e" : "#ffffff",
              border: isPro ? "1px solid #fde68a" : "none"
            }}
          >
            {isPro ? "Pro Plan — Quota Reached" : "Upgrade Required"}
          </span>

          {isPro && (
            <span style={{ fontSize: "0.8125rem", color: "#666666" }}>
              Resets: <strong>{resetDate}</strong>
            </span>
          )}
        </div>

        {/* Modal Title */}
        <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
          {isPro ? "Monthly Feature Limit Reached" : "Unlock VoxFlow Premium"}
        </h2>

        {/* Alert / Reason Message */}
        <p style={{ fontSize: "0.9375rem", color: "#444444", lineHeight: 1.6, marginBottom: "20px" }}>
          {isPro ? (
            <>
              You have exhausted your monthly limit for{" "}
              <strong>
                {featureKey === "meetings"
                  ? "Meeting Transcriptions & Notes"
                  : featureKey === "voice"
                    ? "Voice-to-Text Dictations"
                    : limitReached || "a Pro feature"}
              </strong>
              . Non-exhausted features continue to work without interruption.
            </>
          ) : (
            reason ||
            `You have reached your Free plan quota (${limitReached || "monthly usage limit"}). Upgrade to Premium to continue without interruption.`
          )}
        </p>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#991b1b",
              fontSize: "0.8125rem",
              marginBottom: "16px"
            }}
          >
            {error}
          </div>
        )}

        {/* PRO USER VIEW: Granular Usage Breakdown & Options */}
        {isPro ? (
          <div>
            {/* Feature Usage Overview */}
            <div
              style={{
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "16px",
                marginBottom: "20px"
              }}
            >
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#666666", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Feature Usage Status
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Voice Dictation Status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#111111" }}>Voice Transcription Minutes</span>
                    <div style={{ fontSize: "0.75rem", color: "#666666" }}>
                      {voiceBreakdown ? `${voiceBreakdown.totalRemaining} remaining of ${voiceBreakdown.limit} mins/mo` : "300 mins / month"}
                      {voiceBreakdown?.remainingCredits ? ` (+${voiceBreakdown.remainingCredits} top-up credits)` : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: voiceBreakdown?.isExhausted ? "#fee2e2" : "#f0fdf4",
                      color: voiceBreakdown?.isExhausted ? "#991b1b" : "#166534"
                    }}
                  >
                    {voiceBreakdown?.isExhausted ? "Exhausted" : "Active & Available"}
                  </span>
                </div>

                {/* Meetings Status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#111111" }}>Meeting Notes & Summaries</span>
                    <div style={{ fontSize: "0.75rem", color: "#666666" }}>
                      {meetingsBreakdown ? `${meetingsBreakdown.totalRemaining} remaining of ${meetingsBreakdown.limit}/mo` : "25 / month"}
                      {meetingsBreakdown?.remainingCredits ? ` (+${meetingsBreakdown.remainingCredits} top-up credits)` : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: meetingsBreakdown?.isExhausted ? "#fee2e2" : "#f0fdf4",
                      color: meetingsBreakdown?.isExhausted ? "#991b1b" : "#166534"
                    }}
                  >
                    {meetingsBreakdown?.isExhausted ? "Exhausted" : "Active & Available"}
                  </span>
                </div>
              </div>

              {/* Non-interruption assurance */}
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "10px",
                  borderTop: "1px solid #eeeeee",
                  fontSize: "0.8125rem",
                  color: "#166534",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>✓</span>
                <span>Features with remaining allowance continue to work normally without interruption.</span>
              </div>
            </div>

            {/* Expiry & Reset Details */}
            <div
              style={{
                fontSize: "0.8125rem",
                color: "#666666",
                marginBottom: "20px",
                padding: "8px 12px",
                background: "#f5f5f5",
                borderRadius: "6px"
              }}
            >
              Subscription Period Expiry: <strong>{expiryDate}</strong> • Next Monthly Reset: <strong>{resetDate}</strong>
            </div>

            {/* Two Main Choices */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Option 1: Buy another month ($9) */}
              <div
                style={{
                  border: "1px solid #111111",
                  borderRadius: "6px",
                  padding: "14px",
                  background: "#ffffff"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#111111" }}>
                    Option 1: Buy another month (Early Renewal)
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111111" }}>$9.00 USD</span>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "#666666", margin: "0 0 12px", lineHeight: 1.4 }}>
                  Instantly resets included monthly allowance and extends paid period to{" "}
                  <strong>
                    {new Date(
                      new Date(subscription?.currentPeriodEnd || entitlements?.expiresAt || Date.now()).getTime() +
                        30 * 24 * 60 * 60 * 1000
                    ).toLocaleDateString()}
                  </strong>
                  . No duplicate subscriptions created.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleCheckout("early_renewal")}
                  disabled={loading}
                  style={{ width: "100%", padding: "10px", fontSize: "0.875rem" }}
                >
                  {loading && loadingType === "early_renewal" ? "Preparing Checkout..." : "Buy Another Month — $9 USD"}
                </button>
              </div>

              {/* Option 2: Wait for reset */}
              <div
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  padding: "14px",
                  background: "#fafafa"
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#111111", marginBottom: "4px" }}>
                  Option 2: Wait for reset
                </div>
                <p style={{ fontSize: "0.8125rem", color: "#666666", margin: "0 0 12px", lineHeight: 1.4 }}>
                  Continue using available features whose limits have not been reached. Your full allowance resets on <strong>{resetDate}</strong>.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "0.875rem",
                    color: "#111111",
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 500
                  }}
                >
                  Wait for Reset ({resetDate})
                </button>
              </div>

              {/* Optional Usage Pack Top-up */}
              <div style={{ textAlign: "center", marginTop: "6px" }}>
                <a
                  href="#/billing"
                  onClick={onClose}
                  style={{
                    color: "#4b5563",
                    fontSize: "0.8125rem",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  Need extra transcription minutes? Open Usage Add-on Slider in Billing (from $2)
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* FREE USER VIEW: Upgrade to Pro */
          <div>
            <div
              style={{
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                padding: "16px",
                marginBottom: "24px",
                fontSize: "0.875rem"
              }}
            >
              <div style={{ fontWeight: 600, color: "#111111", marginBottom: "8px" }}>
                VoxFlow Pro ($9/month) includes:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#444444" }}>
                <div>✓ 300 minutes voice transcription / month</div>
                <div>✓ 1,000 voice typing & 500 AI text correction requests / mo</div>
                <div>✓ 25 meeting records & AI summaries / month</div>
                <div>✓ Active Pro badge & priority backend processing</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleCheckout("new")}
                disabled={loading}
                style={{ flex: 1, padding: "12px", fontSize: "0.9375rem" }}
              >
                {loading && loadingType === "new" ? "Redirecting..." : "Upgrade to Pro — $9/mo"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "12px 18px",
                  fontSize: "0.875rem",
                  color: "#666666",
                  background: "#ffffff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
