import React from "react";
import { useSubscription } from "../../lib/subscriptionContext";

export interface PremiumBadgeProps {
  size?: "sm" | "md" | "lg";
  showFree?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  size = "md",
  showFree = false,
  className,
  style
}) => {
  const { isPremium, entitlements, loading } = useSubscription();

  if (loading) {
    return null;
  }

  // Strictly do not render the Premium badge for free or non-entitled accounts
  if (!isPremium) {
    if (showFree) {
      return (
        <span
          className={className}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: size === "sm" ? "1px 6px" : size === "lg" ? "4px 10px" : "2px 8px",
            fontSize: size === "sm" ? "0.6875rem" : size === "lg" ? "0.8125rem" : "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#666666",
            background: "#f5f5f5",
            border: "1px solid #e5e5e5",
            borderRadius: "4px",
            userSelect: "none",
            ...style
          }}
          title="Free Essential Plan"
        >
          Free
        </span>
      );
    }
    return null;
  }

  const isCanceling = entitlements?.cancelAtPeriodEnd;
  const expiresDate = entitlements?.expiresAt
    ? new Date(entitlements.expiresAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      })
    : null;

  const titleText = isCanceling && expiresDate
    ? `VoxFlow Premium — Cancels at end of billing cycle (${expiresDate})`
    : "VoxFlow Premium Member ($9/mo)";

  return (
    <a
      href="#/billing"
      className={className}
      title={titleText}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: size === "sm" ? "2px 7px" : size === "lg" ? "5px 12px" : "3px 9px",
        fontSize: size === "sm" ? "0.6875rem" : size === "lg" ? "0.8125rem" : "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#ffffff",
        background: "#111111",
        border: "1px solid #000000",
        borderRadius: "4px",
        textDecoration: "none",
        cursor: "pointer",
        lineHeight: 1.2,
        userSelect: "none",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        transition: "opacity 0.15s ease",
        ...style
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <span style={{ fontSize: size === "sm" ? "0.625rem" : "0.75rem", color: "#facc15" }}>★</span>
      <span>Premium</span>
      {isCanceling && (
        <span
          style={{
            fontSize: "0.625rem",
            background: "rgba(255,255,255,0.2)",
            padding: "0 4px",
            borderRadius: "2px",
            fontWeight: 500
          }}
          title={`Active until ${expiresDate}`}
        >
          Canceling
        </span>
      )}
    </a>
  );
};
