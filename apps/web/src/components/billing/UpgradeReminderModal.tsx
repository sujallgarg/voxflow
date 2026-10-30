import React, { useEffect, useRef } from "react";
import type { ReminderConfig } from "../../lib/upgradeReminders";
import { recordPopupShown, recordPopupDismissed, recordUpgradeClicked } from "../../lib/upgradeReminders";

interface UpgradeReminderModalProps {
  isOpen: boolean;
  config: ReminderConfig | null;
  onClose: () => void;
  onExplorePro: () => void;
}

export const UpgradeReminderModal: React.FC<UpgradeReminderModalProps> = ({
  isOpen,
  config,
  onClose,
  onExplorePro
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus trap & Escape key handler
  useEffect(() => {
    if (!isOpen || !config) return;

    recordPopupShown(config.type);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    primaryButtonRef.current?.focus();

    // Prevent background scrolling while open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, config]);

  if (!isOpen || !config) return null;

  const handleDismiss = () => {
    recordPopupDismissed(config.type);
    onClose();
  };

  const handleExplore = () => {
    recordUpgradeClicked(config.type);
    onClose();
    onExplorePro();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 9999
      }}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-reminder-title"
      aria-describedby="upgrade-reminder-description"
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: "460px",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e5e5e5",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
          padding: "clamp(24px, 5vw, 32px)",
          position: "relative",
          boxSizing: "border-box"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close reminder"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            backgroundColor: "#f5f5f5",
            border: "1px solid #e5e5e5",
            color: "#666666",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e5e5e5";
            e.currentTarget.style.color = "#111111";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f5f5f5";
            e.currentTarget.style.color = "#666666";
          }}
        >
          ✕
        </button>

        {/* Pro Badge Icon Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: "#111111",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "13px"
            }}
          >
            ★
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#666666"
            }}
          >
            VoxFlow Premium
          </span>
        </div>

        {/* Modal Title */}
        <h3
          id="upgrade-reminder-title"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#111111",
            lineHeight: 1.3,
            marginBottom: "10px",
            letterSpacing: "-0.02em"
          }}
        >
          {config.title}
        </h3>

        {/* Description */}
        <p
          id="upgrade-reminder-description"
          style={{
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            color: "#555555",
            marginBottom: "20px"
          }}
        >
          {config.description}
        </p>

        {/* Optional Usage Meter */}
        {config.percentage !== undefined && (
          <div
            style={{
              backgroundColor: "#fafafa",
              border: "1px solid #e5e5e5",
              borderRadius: "6px",
              padding: "12px 14px",
              marginBottom: "20px"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.8125rem",
                color: "#111111",
                fontWeight: 600,
                marginBottom: "8px"
              }}
            >
              <span>{config.metricLabel}</span>
              <span>{config.percentage}% used</span>
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                backgroundColor: "#e5e5e5",
                borderRadius: "3px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, config.percentage)}%`,
                  height: "100%",
                  backgroundColor: "#111111",
                  borderRadius: "3px",
                  transition: "width 0.3s ease"
                }}
              />
            </div>
          </div>
        )}

        {/* Pro Highlight Card */}
        {config.highlight && (
          <div
            style={{
              backgroundColor: "#fafafa",
              border: "1px solid #e5e5e5",
              borderRadius: "6px",
              padding: "12px 14px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px"
            }}
          >
            <span style={{ fontSize: "14px", color: "#111111", marginTop: "1px" }}>✓</span>
            <span style={{ fontSize: "0.84375rem", color: "#444444", lineHeight: 1.5 }}>
              {config.highlight}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap"
          }}
        >
          <button
            ref={primaryButtonRef}
            type="button"
            className="btn-primary"
            onClick={handleExplore}
            style={{
              flex: "1 1 180px",
              padding: "11px 20px",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Explore Premium Plans
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleDismiss}
            style={{
              flex: "1 1 120px",
              padding: "11px 16px",
              fontSize: "0.9rem",
              cursor: "pointer"
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
