import React, { useState, useEffect } from "react";
import { Logo } from "./Logo";

interface EarlyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EarlyAccessModal: React.FC<EarlyAccessModalProps> = ({
  isOpen,
  onClose
}) => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

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
    if (email.trim()) {
      setIsSubmitted(true);
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
        background: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
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
          maxWidth: "480px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "36px 32px",
          boxShadow:
            "0 25px 60px -15px rgba(126, 20, 255, 0.25), 0 8px 30px rgba(0, 0, 0, 0.12)",
          position: "relative",
          border: "1px solid rgba(126, 20, 255, 0.16)"
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
            top: "20px",
            right: "20px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#f1f5f9",
            color: "#64748b",
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ✕
        </button>

        {!isSubmitted ? (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <Logo size={36} />
            </div>

            <h3
              id="modal-title"
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "8px"
              }}
            >
              Join the VoxFlow Beta
            </h3>

            <p
              style={{
                fontSize: "0.9375rem",
                color: "#64748b",
                lineHeight: 1.6,
                marginBottom: "24px"
              }}
            >
              The VoxFlow Chrome Extension is currently in developer preview and
              active beta testing. Sign up to receive the direct installation package
              and early access to the upcoming Chrome Web Store launch.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  htmlFor="beta-email"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px"
                  }}
                >
                  Work or Personal Email
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
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9375rem",
                    outline: "none"
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
              >
                Request Beta Invitation →
              </button>
            </form>

            <p
              style={{
                marginTop: "16px",
                fontSize: "0.75rem",
                color: "#94a3b8",
                textAlign: "center"
              }}
            >
              Zero spam. We'll only contact you with release builds and feedback requests.
            </p>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#10b981",
                fontSize: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px auto"
              }}
            >
              ✓
            </div>

            <h3
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "8px"
              }}
            >
              You're on the Beta List!
            </h3>

            <p
              style={{
                fontSize: "0.9375rem",
                color: "#64748b",
                lineHeight: 1.6,
                marginBottom: "24px"
              }}
            >
              Thanks for your interest in VoxFlow. We've reserved your spot for <strong>{email}</strong> and will email you installation instructions as new slots open.
            </p>

            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ width: "100%", padding: "12px" }}
            >
              Back to Website
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
