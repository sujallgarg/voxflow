import React, { useState } from "react";
import { isBannerDismissed, dismissDashboardBanner, recordUpgradeClicked } from "../../lib/upgradeReminders";
import type { UserEntitlements } from "@voxflow/shared";

interface DashboardUpgradeBannerProps {
  entitlements: UserEntitlements | null;
  onExplorePro: () => void;
}

export const DashboardUpgradeBanner: React.FC<DashboardUpgradeBannerProps> = ({
  entitlements,
  onExplorePro
}) => {
  const [dismissed, setDismissed] = useState(() => isBannerDismissed());

  if (dismissed || entitlements?.isPremium) {
    return null;
  }

  const handleDismiss = () => {
    dismissDashboardBanner();
    setDismissed(true);
  };

  const handleExplore = () => {
    recordUpgradeClicked("dashboard_banner");
    onExplorePro();
  };

  const meetingsUsed = entitlements?.usage?.meetingsUsed || 0;
  const meetingsLimit = entitlements?.limits?.monthlyMeetings || 3;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #111111",
        borderRadius: "8px",
        padding: "16px 20px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "14px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
      }}
      role="region"
      aria-label="Premium upgrade suggestion"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", maxWidth: "680px" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            flexShrink: 0,
            marginTop: "2px"
          }}
        >
          ★
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <strong style={{ fontSize: "0.9375rem", color: "#111111" }}>
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
          <p style={{ fontSize: "0.84375rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
            Need more voice typing or meeting capacity? Explore the available plans to find the right fit. You have used {meetingsUsed} of {meetingsLimit} included free monthly meetings.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleExplore}
          style={{ fontSize: "0.8125rem", padding: "7px 14px", borderRadius: "6px" }}
        >
          Explore Premium Plans
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss Premium banner"
          style={{
            background: "none",
            border: "1px solid #e5e5e5",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "0.8125rem",
            color: "#666666",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
