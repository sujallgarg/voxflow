import React, { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { api } from "../lib/api";

interface EarlyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPrivacy?: () => void;
}

export const EarlyAccessModal: React.FC<EarlyAccessModalProps> = ({
  isOpen,
  onClose,
  onNavigateToPrivacy
}) => {
  const [email, setEmail] = useState("");
  const [marketingUpdates, setMarketingUpdates] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackendSynced, setIsBackendSynced] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (cleanEmail) {
      setIsSyncing(true);
      try {
        const stored = JSON.parse(localStorage.getItem("voxflow_waitlist_emails") || "[]");
        if (Array.isArray(stored) && !stored.includes(cleanEmail)) {
          stored.push(cleanEmail);
          localStorage.setItem("voxflow_waitlist_emails", JSON.stringify(stored));
        }
      } catch (err) {
        console.warn("Could not save waitlist email:", err);
      }

      api.joinWaitlist(cleanEmail, "website_modal", marketingUpdates)
        .then(() => {
          setIsBackendSynced(true);
        })
        .catch((err) => {
          console.warn("Backend waitlist sync notice:", err);
          setIsBackendSynced(false);
        })
        .finally(() => {
          setIsSyncing(false);
          setIsSubmitted(true);
        });
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
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 100
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "32px 28px",
          position: "relative",
          border: "1px solid #e5e5e5",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "30px",
            height: "30px",
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

        {!isSubmitted ? (
          <div>
            <div style={{ marginBottom: "18px" }}>
              <Logo size={32} />
            </div>

            <h3
              id="modal-title"
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#111111",
                marginBottom: "8px"
              }}
            >
              Get Started with VoxFlow
            </h3>

            <p
              style={{
                fontSize: "0.875rem",
                color: "#666666",
                lineHeight: 1.6,
                marginBottom: "20px"
              }}
            >
              Sign up to receive the VoxFlow Chrome extension package and early access notifications for the upcoming Chrome Web Store release.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  htmlFor="beta-email"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#111111",
                    marginBottom: "6px"
                  }}
                >
                  Email Address
                </label>
                <input
                  id="beta-email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid #e5e5e5",
                    fontSize: "0.875rem",
                    outline: "none",
                    color: "#111111",
                    background: "#ffffff"
                  }}
                />
              </div>

              {/* Optional Marketing Consent */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <input
                  id="marketing-consent"
                  type="checkbox"
                  checked={marketingUpdates}
                  onChange={(e) => setMarketingUpdates(e.target.checked)}
                  style={{ marginTop: "3px", width: "15px", height: "15px", cursor: "pointer", accentColor: "#111111" }}
                />
                <label
                  htmlFor="marketing-consent"
                  style={{ fontSize: "0.8125rem", color: "#666666", lineHeight: 1.5, cursor: "pointer" }}
                >
                  Send me product announcements and beta release updates.
                </label>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isSyncing}
                style={{ width: "100%", padding: "12px", fontSize: "0.875rem", borderRadius: "6px" }}
              >
                {isSyncing ? "Registering..." : "Join Public Beta"}
              </button>
            </form>

            <p
              style={{
                marginTop: "16px",
                fontSize: "0.75rem",
                color: "#666666",
                textAlign: "center",
                lineHeight: 1.5
              }}
            >
              By submitting your email, you acknowledge that your information will be processed in accordance with our{" "}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToPrivacy) onNavigateToPrivacy();
                  else window.location.hash = "#/privacy";
                }}
                style={{
                  color: "#111111",
                  textDecoration: "underline",
                  fontSize: "0.75rem",
                  padding: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#111111",
                color: "#ffffff",
                fontSize: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto"
              }}
            >
              ✓
            </div>

            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "#111111",
                marginBottom: "8px"
              }}
            >
              You're on the Beta List
            </h3>

            <p
              style={{
                fontSize: "0.875rem",
                color: "#666666",
                lineHeight: 1.6,
                marginBottom: "20px"
              }}
            >
              {isBackendSynced ? (
                <>Your email <strong>{email}</strong> has been registered. You will receive private beta release notifications.</>
              ) : (
                <>Your email <strong>{email}</strong> has been saved for this session.</>
              )}
            </p>

            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ width: "100%", padding: "10px", fontSize: "0.875rem", borderRadius: "6px" }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
