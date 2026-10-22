import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/authContext";
import { getCurrentUser } from "../../lib/userStore";
import type { UserEntitlements } from "@voxflow/shared";

import { notifySubscriptionChanged } from "../../lib/subscriptionContext";

interface CheckoutSuccessProps {
  onBackToApp: () => void;
  onNavigateToBilling: () => void;
}

export const CheckoutSuccessPage: React.FC<CheckoutSuccessProps> = ({
  onBackToApp,
  onNavigateToBilling
}) => {
  const { user } = useAuth();
  const currentUser = getCurrentUser();
  const userId = user?.id || currentUser.id;

  const [verifying, setVerifying] = useState(true);
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const getSessionId = (): string | undefined => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const fromSearch = searchParams.get("session_id") || searchParams.get("checkout_session_id");
      if (fromSearch && fromSearch !== "{CHECKOUT_SESSION_ID}") return fromSearch;

      const hash = window.location.hash || "";
      const qIndex = hash.indexOf("?");
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(hash.slice(qIndex));
        const fromHash = hashParams.get("session_id") || hashParams.get("checkout_session_id");
        if (fromHash && fromHash !== "{CHECKOUT_SESSION_ID}") return fromHash;
      }
    } catch {
      // Ignore
    }
    return undefined;
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const verifyStatus = async () => {
      try {
        const sessionId = getSessionId();
        const res = await api.getSubscription(userId, sessionId);
        setEntitlements(res.entitlements);

        if (res.entitlements.isPremium) {
          setVerifying(false);
          notifySubscriptionChanged();
          return;
        }

        // If webhook processing is taking an extra second, poll up to 4 times
        if (!res.entitlements.isPremium && pollCount < 4) {
          timer = setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 1500);
        } else {
          setVerifying(false);
          notifySubscriptionChanged();
        }
      } catch (e) {
        setVerifying(false);
      }
    };

    void verifyStatus();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [userId, pollCount]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px"
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          padding: "48px 32px"
        }}
      >
        {verifying ? (
          <div>
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid #e5e5e5",
                borderTopColor: "#111111",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px"
              }}
            />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
              Verifying Payment with Gateway...
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.6, margin: 0 }}>
              Confirming server-side signed webhook confirmation and updating your account entitlements.
            </p>
          </div>
        ) : entitlements?.isPremium ? (
          <div>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#f0fdf4",
                color: "#166534",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "20px"
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
              Welcome to VoxFlow Premium
            </h2>
            <p style={{ fontSize: "0.9375rem", color: "#666666", lineHeight: 1.6, marginBottom: "28px" }}>
              Your $9 USD/month subscription is verified and active. You now have access to 2,000 voice dictations, 100 meeting notes, and enhanced analytics.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={onBackToApp}
                style={{ width: "100%", padding: "12px", fontSize: "0.9375rem" }}
              >
                Go to Workspace
              </button>
              <button
                type="button"
                onClick={onNavigateToBilling}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "0.875rem",
                  color: "#666666",
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                View Subscription & Invoices
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#991b1b",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "20px"
              }}
            >
              !
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
              Payment Processing Notice
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#666666", lineHeight: 1.6, marginBottom: "24px" }}>
              We have not received authoritative payment confirmation from the gateway yet. If your payment was completed, it will activate automatically once the provider webhook arrives.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={onBackToApp}
                style={{ width: "100%", padding: "12px", fontSize: "0.9375rem" }}
              >
                Return to Meetings
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerifying(true);
                  setPollCount((prev) => prev + 1);
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "0.875rem",
                  color: "#111111",
                  background: "#f5f5f5",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Re-check Status
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface CheckoutCancelProps {
  onBackToApp: () => void;
  onNavigateToPricing: () => void;
}

export const CheckoutCancelPage: React.FC<CheckoutCancelProps> = ({
  onBackToApp,
  onNavigateToPricing
}) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px"
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
          textAlign: "center",
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          padding: "48px 32px"
        }}
      >
        <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111111", marginBottom: "8px" }}>
          Checkout Canceled
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "#666666", lineHeight: 1.6, marginBottom: "28px" }}>
          No charges were made to your payment method. You can retry checkout anytime or continue using VoxFlow Free.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={onNavigateToPricing}
            style={{ width: "100%", padding: "12px", fontSize: "0.9375rem" }}
          >
            Review Plans & Retry
          </button>
          <button
            type="button"
            onClick={onBackToApp}
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "0.875rem",
              color: "#666666",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            ← Return to Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
