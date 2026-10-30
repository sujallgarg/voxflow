import React from "react";
import { EXTENSION_NAME } from "../../lib/extensionConfig";

interface ExtensionNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEarlyAccess?: () => void;
}

export const ExtensionNoticeModal: React.FC<ExtensionNoticeModalProps> = ({
  isOpen,
  onClose,
  onOpenEarlyAccess
}) => {
  if (!isOpen) return null;

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
        zIndex: 110
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="extension-notice-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "clamp(24px, 4vw, 32px)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
          position: "relative",
          border: "1px solid #e5e5e5",
          boxSizing: "border-box"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            color: "#111111",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          ✕
        </button>

        <div style={{ display: "inline-block", marginBottom: "14px" }}>
          <span className="badge" style={{ background: "#f5f5f5", color: "#111111", border: "1px solid #e5e5e5" }}>
            Chrome Web Store Listing Pending
          </span>
        </div>

        <h3
          id="extension-notice-title"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#111111",
            marginBottom: "10px"
          }}
        >
          {EXTENSION_NAME}
        </h3>

        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "#555555",
            marginBottom: "16px"
          }}
        >
          The VoxFlow Chrome Extension is currently undergoing the Google Chrome Web Store review process.
          Once approved, this button will direct you straight to the official Chrome Web Store installation page.
        </p>

        <div
          style={{
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "6px",
            padding: "12px 14px",
            fontSize: "0.8125rem",
            color: "#444444",
            lineHeight: 1.5,
            marginBottom: "24px"
          }}
        >
          <strong>Temporary Developer Access:</strong> You can sign up for our early access program to receive the extension developer package and installation guide today.
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {onOpenEarlyAccess && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onClose();
                onOpenEarlyAccess();
              }}
              style={{
                flex: 1,
                minWidth: "160px",
                padding: "10px 18px",
                fontSize: "0.875rem",
                borderRadius: "6px"
              }}
            >
              Get Early Access Package →
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{
              flex: onOpenEarlyAccess ? 0.6 : 1,
              minWidth: "100px",
              padding: "10px 18px",
              fontSize: "0.875rem",
              borderRadius: "6px"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
