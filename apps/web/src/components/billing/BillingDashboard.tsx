import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/authContext";
import { getCurrentUser } from "../../lib/userStore";
import { notifySubscriptionChanged } from "../../lib/subscriptionContext";
import type { UserEntitlements, BillingInvoice } from "@voxflow/shared";
import { UsageAddonSlider } from "./UsageAddonSlider";

interface BillingDashboardProps {
  onBackToHome: () => void;
  onNavigateToPricing: () => void;
}

export const BillingDashboard: React.FC<BillingDashboardProps> = ({
  onBackToHome,
  onNavigateToPricing
}) => {
  const { user } = useAuth();
  const currentUser = getCurrentUser();
  const userId = user?.id || currentUser.id;

  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const subRes = await api.getSubscription(userId);
      setEntitlements(subRes.entitlements);

      const invRes = await api.getInvoices(userId);
      setInvoices(invRes.invoices || []);
    } catch (err: any) {
      console.warn("Notice: could not load billing data:", err);
      setError(err?.message || "Failed to load subscription details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBillingData();

    const handleSync = () => {
      void loadBillingData();
    };

    window.addEventListener("voxflow_subscription_updated", handleSync);
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);

    return () => {
      window.removeEventListener("voxflow_subscription_updated", handleSync);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
    };
  }, [userId]);

  const handleOpenCustomerPortal = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.createPortalSession(userId);
      if (res?.portalUrl) {
        window.location.href = res.portalUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to open customer billing portal.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel your VoxFlow Premium subscription? You will retain Premium access until the end of the current billing cycle."
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await api.cancelSubscription(userId);
      setMessage(res.message || "Your subscription has been canceled.");
      await loadBillingData();
      notifySubscriptionChanged();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel subscription.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEarlyRenewal = async () => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.createCheckoutSession("premium_monthly", userId, "early_renewal");
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to initiate early renewal checkout.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", paddingBottom: "80px" }}>
      {/* Top Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e5e5",
          position: "sticky",
          top: 0,
          zIndex: 40,
          height: "68px"
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "100%"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                background: "none",
                border: "none",
                fontSize: "0.875rem",
                color: "#666666",
                cursor: "pointer",
                padding: "6px 0",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              ← Back to App
            </button>
            <span style={{ color: "#cccccc" }}>/</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111111" }}>
              Billing & Subscription
            </span>
          </div>

          <div>
            <a
              href="#/pricing"
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#111111",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #e5e5e5"
              }}
            >
              Plans & Pricing
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container" style={{ maxWidth: "800px", marginTop: "40px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
            Subscription & Usage
          </h1>
          <p style={{ fontSize: "0.9375rem", color: "#666666", margin: 0 }}>
            Manage your VoxFlow plan, monitor monthly quota consumption, and view invoice history.
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: "14px 18px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              color: "#166534",
              fontSize: "0.875rem",
              marginBottom: "24px"
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "14px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#991b1b",
              fontSize: "0.875rem",
              marginBottom: "24px"
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid #e5e5e5",
                borderTopColor: "#111111",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px"
              }}
            />
            <p style={{ fontSize: "0.875rem", color: "#666666" }}>Loading subscription status...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* Card 1: Current Plan Status */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                padding: "28px 24px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "20px"
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#666666",
                      display: "block",
                      marginBottom: "4px"
                    }}
                  >
                    Current Plan
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111111", margin: 0 }}>
                      VoxFlow {entitlements?.planName || "Free"}
                    </h2>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: entitlements?.isPremium ? "#111111" : "#f5f5f5",
                        color: entitlements?.isPremium ? "#ffffff" : "#666666"
                      }}
                    >
                      {entitlements?.status?.toUpperCase() || "FREE"}
                    </span>
                  </div>
                </div>

                <div>
                  {entitlements?.isPremium ? (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        onClick={handleOpenCustomerPortal}
                        disabled={actionLoading}
                        style={{
                          padding: "8px 14px",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          background: "#ffffff",
                          color: "#111111",
                          border: "1px solid #e5e5e5",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        {actionLoading ? "Loading..." : "Manage Billing"}
                      </button>
                      {!entitlements.cancelAtPeriodEnd && (
                        <button
                          type="button"
                          onClick={handleCancelSubscription}
                          disabled={actionLoading}
                          style={{
                            padding: "8px 14px",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            background: "#ffffff",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={onNavigateToPricing}
                      style={{ padding: "9px 18px", fontSize: "0.875rem" }}
                    >
                      Upgrade to Premium ($9/mo)
                    </button>
                  )}
                </div>
              </div>

              {entitlements?.expiresAt && (
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "#666666",
                    background: "#fafafa",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid #eeeeee"
                  }}
                >
                  {entitlements.cancelAtPeriodEnd ? (
                    <span>
                      Subscription is canceled and will expire on{" "}
                      <strong>{new Date(entitlements.expiresAt).toLocaleDateString()}</strong>.
                    </span>
                  ) : (
                    <span>
                      Renews automatically on{" "}
                      <strong>{new Date(entitlements.expiresAt).toLocaleDateString()}</strong> at $9 USD/month.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Upgrade banner for Free accounts */}
            {!entitlements?.isPremium && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #111111",
                  borderRadius: "8px",
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
                }}
              >
                <div style={{ maxWidth: "620px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "1rem", color: "#111111" }}>
                      Unlock more with VoxFlow Premium
                    </strong>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "#f5f5f5",
                        border: "1px solid #e5e5e5",
                        color: "#666666",
                        fontWeight: 600
                      }}
                    >
                      $9/month
                    </span>
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                    Need more voice typing or meeting capacity? Explore the available plans to find the right fit. Free accounts include 3 meetings and 100 voice typing requests per month.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onNavigateToPricing}
                  style={{ padding: "9px 18px", fontSize: "0.875rem", flexShrink: 0 }}
                >
                  Explore Premium Plans
                </button>
              </div>
            )}

            {/* Card 2: Quota & Usage Meters */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                padding: "28px 24px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111111", margin: 0 }}>
                    Monthly Quota & Credit Balances ({entitlements?.usage.periodYearMonth})
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "#666666", marginTop: "2px" }}>
                    Resets on {entitlements?.resetDate ? new Date(entitlements.resetDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "next cycle"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => loadBillingData()}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "5px 12px" }}
                  title="Refresh authoritative usage from server"
                >
                  ↻ Refresh Usage
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* 1. Voice Transcription Minutes Meter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.875rem",
                      marginBottom: "6px"
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#111111" }}>
                      🎙️ Audio Transcription (Actual Duration)
                    </span>
                    <span style={{ color: "#666666" }}>
                      <strong>{entitlements?.breakdown?.transcriptionMinutes.used ?? entitlements?.voice?.used ?? 0}</strong> /{" "}
                      {entitlements?.breakdown?.transcriptionMinutes.limit ?? entitlements?.limits.transcriptionMinutes ?? 30} mins
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "#f0f0f0",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(
                          100,
                          (((entitlements?.breakdown?.transcriptionMinutes.used ?? entitlements?.voice?.used ?? 0) /
                            (entitlements?.breakdown?.transcriptionMinutes.limit ?? entitlements?.limits.transcriptionMinutes ?? 30)) *
                            100)
                        )}%`,
                        background: "#111111",
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                </div>

                {/* Purchased Top-Up Credits (Separate Accounting) */}
                <div
                  style={{
                    background: "#fafafa",
                    border: "1px solid #eeeeee",
                    borderRadius: "6px",
                    padding: "12px 16px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111111" }}>
                        Purchased Add-On Transcription Credits
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#666666" }}>
                        Separate top-up balance • Rolls over across monthly renewals • Consumed when monthly allowance is exhausted
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111111" }}>
                        {entitlements?.breakdown?.transcriptionMinutes.remainingCredits ?? entitlements?.voice?.remainingCredits ?? 0} mins
                      </span>
                      <div style={{ fontSize: "0.75rem", color: "#666666" }}>
                        remaining of {entitlements?.breakdown?.transcriptionMinutes.purchasedCredits ?? entitlements?.voice?.purchasedCredits ?? 0} purchased
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Voice Typing Requests Meter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.875rem",
                      marginBottom: "6px"
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#111111" }}>🗣️ Voice Typing Operations</span>
                    <span style={{ color: "#666666" }}>
                      <strong>{entitlements?.breakdown?.voiceTyping.used ?? entitlements?.usage.voiceTypingUsed ?? 0}</strong> /{" "}
                      {entitlements?.breakdown?.voiceTyping.limit ?? entitlements?.limits.voiceTypingRequests ?? 100} requests
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "#f0f0f0",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(
                          100,
                          (((entitlements?.breakdown?.voiceTyping.used ?? entitlements?.usage.voiceTypingUsed ?? 0) /
                            (entitlements?.breakdown?.voiceTyping.limit ?? entitlements?.limits.voiceTypingRequests ?? 100)) *
                            100)
                        )}%`,
                        background: "#111111",
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                </div>

                {/* 3. AI Text Corrections Meter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.875rem",
                      marginBottom: "6px"
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#111111" }}>✍️ AI Text Corrections & Transformations</span>
                    <span style={{ color: "#666666" }}>
                      <strong>{entitlements?.breakdown?.textCorrection.used ?? entitlements?.usage.textCorrectionsUsed ?? 0}</strong> /{" "}
                      {entitlements?.breakdown?.textCorrection.limit ?? entitlements?.limits.textCorrectionRequests ?? 50} requests
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "#f0f0f0",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(
                          100,
                          (((entitlements?.breakdown?.textCorrection.used ?? entitlements?.usage.textCorrectionsUsed ?? 0) /
                            (entitlements?.breakdown?.textCorrection.limit ?? entitlements?.limits.textCorrectionRequests ?? 50)) *
                            100)
                        )}%`,
                        background: "#111111",
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                </div>

                {/* 4. Meetings Meter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.875rem",
                      marginBottom: "6px"
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#111111" }}>📅 Recorded & Captured Meetings</span>
                    <span style={{ color: "#666666" }}>
                      <strong>{entitlements?.breakdown?.meetings.used ?? entitlements?.usage.meetingsUsed ?? 0}</strong> /{" "}
                      {entitlements?.breakdown?.meetings.limit ?? entitlements?.limits.monthlyMeetings ?? 3} meetings
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "#f0f0f0",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(
                          100,
                          (((entitlements?.breakdown?.meetings.used ?? entitlements?.usage.meetingsUsed ?? 0) /
                            (entitlements?.breakdown?.meetings.limit ?? entitlements?.limits.monthlyMeetings ?? 3)) *
                            100)
                        )}%`,
                        background: "#111111",
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                </div>

                {/* 5. AI Meeting Summaries Meter */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.875rem",
                      marginBottom: "6px"
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#111111" }}>📝 AI Meeting Summaries</span>
                    <span style={{ color: "#666666" }}>
                      <strong>{entitlements?.breakdown?.summaries.used ?? entitlements?.usage.meetingSummariesUsed ?? 0}</strong> /{" "}
                      {entitlements?.breakdown?.summaries.limit ?? entitlements?.limits.meetingSummaries ?? 3} summaries
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "#f0f0f0",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(
                          100,
                          (((entitlements?.breakdown?.summaries.used ?? entitlements?.usage.meetingSummariesUsed ?? 0) /
                            (entitlements?.breakdown?.summaries.limit ?? entitlements?.limits.meetingSummaries ?? 3)) *
                            100)
                        )}%`,
                        background: "#111111",
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                </div>

                {/* Pro Early Renewal Option */}
                {entitlements?.isPremium && (
                  <div
                    style={{
                      marginTop: "8px",
                      paddingTop: "20px",
                      borderTop: "1px solid #eeeeee",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}
                  >
                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e5e5e5",
                        borderRadius: "6px",
                        padding: "16px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#111111" }}>
                          Early Subscription Renewal
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111111" }}>$9.00 USD</span>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "#666666", margin: "0 0 10px", lineHeight: 1.5 }}>
                        Current paid-through date:{" "}
                        <strong>
                          {entitlements.expiresAt ? new Date(entitlements.expiresAt).toLocaleDateString() : "Active"}
                        </strong>
                        . Renewing early instantly resets your included monthly usage and extends your paid-through date to{" "}
                        <strong>
                          {entitlements.expiresAt
                            ? new Date(new Date(entitlements.expiresAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
                            : "30 days forward"}
                        </strong>
                        . Your existing Pro access is preserved without duplicate recurring subscriptions.
                      </p>
                      <button
                        type="button"
                        onClick={handleEarlyRenewal}
                        disabled={actionLoading}
                        style={{
                          padding: "10px 16px",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          background: "#111111",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: actionLoading ? "wait" : "pointer",
                          transition: "opacity 0.15s ease"
                        }}
                      >
                        {actionLoading ? "Processing Early Renewal..." : "Renew Early & Extend Paid Period ($9 USD)"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2B: Usage Add-on Slider (Pro Users) */}
            {entitlements?.isPremium && (
              <UsageAddonSlider
                isPro={true}
                currentPlanName={entitlements.planName}
                renewalDate={entitlements.expiresAt}
                onSuccess={loadBillingData}
              />
            )}

            {/* Card 3: Invoices & Billing History */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                padding: "28px 24px"
              }}
            >
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111111", marginBottom: "16px" }}>
                Invoices & Payment History
              </h3>

              {invoices.length === 0 ? (
                <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0 }}>
                  No payment invoices on record.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #eeeeee", textAlign: "left", color: "#666666" }}>
                        <th style={{ padding: "8px 0" }}>Date</th>
                        <th style={{ padding: "8px 0" }}>Invoice ID</th>
                        <th style={{ padding: "8px 0" }}>Amount</th>
                        <th style={{ padding: "8px 0" }}>Status</th>
                        <th style={{ padding: "8px 0", textAlign: "right" }}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "12px 0", color: "#111111" }}>
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "12px 0", color: "#666666", fontFamily: "monospace" }}>
                            {inv.providerInvoiceId}
                          </td>
                          <td style={{ padding: "12px 0", color: "#111111", fontWeight: 500 }}>
                            ${(inv.amountPaidCents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                          </td>
                          <td style={{ padding: "12px 0" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "10px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: inv.status === "paid" ? "#f0fdf4" : "#fef2f2",
                                color: inv.status === "paid" ? "#166534" : "#991b1b"
                              }}
                            >
                              {inv.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "12px 0", textAlign: "right" }}>
                            {inv.hostedInvoiceUrl ? (
                              <a
                                href={inv.hostedInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#111111", textDecoration: "underline" }}
                              >
                                View Receipt ↗
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
