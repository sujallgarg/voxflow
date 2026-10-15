import React, { useState, useEffect } from "react";
import {
  getStoredConsent,
  saveConsent,
  acceptAllConsent,
  rejectOptionalConsent,
  type CookieConsentCategories
} from "../../lib/consent";

interface CookieConsentBannerProps {
  forceOpenModal?: boolean;
  onCloseForceModal?: () => void;
  onNavigateToCookiePolicy?: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  forceOpenModal = false,
  onCloseForceModal,
  onNavigateToCookiePolicy
}) => {
  const [showBanner, setShowBanner] = useState(() => {
    const stored = getStoredConsent();
    return !stored || !stored.hasAnswered;
  });
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [categories, setCategories] = useState<CookieConsentCategories>(() => {
    const stored = getStoredConsent();
    return stored?.categories || {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false
    };
  });

  useEffect(() => {
    if (forceOpenModal) {
      const stored = getStoredConsent();
      if (stored) {
        setCategories(stored.categories);
      }
      setIsCustomizeOpen(true);
    }
  }, [forceOpenModal]);

  const handleAcceptAll = () => {
    acceptAllConsent();
    setShowBanner(false);
    setIsCustomizeOpen(false);
    if (onCloseForceModal) onCloseForceModal();
  };

  const handleRejectOptional = () => {
    rejectOptionalConsent();
    setShowBanner(false);
    setIsCustomizeOpen(false);
    if (onCloseForceModal) onCloseForceModal();
  };

  const handleSaveCustom = () => {
    saveConsent(categories);
    setShowBanner(false);
    setIsCustomizeOpen(false);
    if (onCloseForceModal) onCloseForceModal();
  };

  const handleCloseModal = () => {
    setIsCustomizeOpen(false);
    if (onCloseForceModal) onCloseForceModal();
  };

  if (!showBanner && !isCustomizeOpen) {
    return null;
  }

  return (
    <>
      {/* 1. FLOATING BOTTOM BANNER (Visible on first visit) */}
      {showBanner && !isCustomizeOpen && (
        <div
          role="region"
          aria-label="Privacy and Cookie Consent"
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            right: "20px",
            maxWidth: "960px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px 24px",
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06)",
            border: "1px solid #e2e8f0",
            zIndex: 999,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "18px"
          }}
        >
          <div style={{ flex: "1 1 500px" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
              Privacy & Storage Preferences
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.5, margin: 0 }}>
              VoxFlow uses strictly necessary local storage to manage your session profile, cache meeting transcripts, and record consent. We do not use third-party advertising or cross-site tracking cookies. You may choose to accept all or customize optional categories.{" "}
              {onNavigateToCookiePolicy && (
                <button
                  type="button"
                  onClick={onNavigateToCookiePolicy}
                  style={{
                    color: "#111111",
                    textDecoration: "underline",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    padding: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  Read our Cookie Policy
                </button>
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRejectOptional}
              style={{ fontSize: "0.875rem", padding: "9px 16px", borderRadius: "6px" }}
            >
              Reject Optional
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setIsCustomizeOpen(true)}
              style={{ fontSize: "0.875rem", padding: "9px 16px", borderRadius: "6px" }}
            >
              Customize
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAcceptAll}
              style={{ fontSize: "0.875rem", padding: "9px 18px", borderRadius: "6px" }}
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {/* 2. GRANULAR PREFERENCES MODAL */}
      {isCustomizeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-settings-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e2e8f0",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <h2 id="cookie-settings-title" style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
                Customize Cookie & Storage Preferences
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Close modal"
                style={{
                  background: "#f1f5f9",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: "16px"
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.6, marginBottom: "24px" }}>
              Select which categories of storage and cookies you allow VoxFlow to use. Essential storage is strictly required for the platform to operate.
            </p>

            {/* Category 1: Essential */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  Strictly Necessary Storage
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#111111", background: "#f5f5f5", border: "1px solid #e5e5e5", padding: "2px 8px", borderRadius: "4px" }}>
                  Always Active
                </span>
              </div>
              <p style={{ fontSize: "0.825rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                Enables essential features including account sessions, local meeting note caching, offline waitlist fallback, and consent storage.
              </p>
            </div>

            {/* Category 2: Analytics */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "6px", padding: "14px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label htmlFor="cat-analytics" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111111", cursor: "pointer" }}>
                  Analytics & Diagnostics
                </label>
                <input
                  id="cat-analytics"
                  type="checkbox"
                  checked={categories.analytics}
                  onChange={(e) => setCategories({ ...categories, analytics: e.target.checked })}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#111111" }}
                />
              </div>
              <p style={{ fontSize: "0.825rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                Helps measure technical latency, error rates, and platform stability. No third-party trackers are currently enabled.
              </p>
            </div>

            {/* Category 3: Functional */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "6px", padding: "14px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label htmlFor="cat-functional" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111111", cursor: "pointer" }}>
                  Functional Preferences
                </label>
                <input
                  id="cat-functional"
                  type="checkbox"
                  checked={categories.functional}
                  onChange={(e) => setCategories({ ...categories, functional: e.target.checked })}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#111111" }}
                />
              </div>
              <p style={{ fontSize: "0.825rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                Remembers custom interface preferences like language selections and editor formatting options.
              </p>
            </div>

            {/* Category 4: Marketing */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label htmlFor="cat-marketing" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111111", cursor: "pointer" }}>
                  Marketing & Advertising
                </label>
                <input
                  id="cat-marketing"
                  type="checkbox"
                  checked={categories.marketing}
                  onChange={(e) => setCategories({ ...categories, marketing: e.target.checked })}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#111111" }}
                />
              </div>
              <p style={{ fontSize: "0.825rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
                Used for cross-site targeting and campaign attribution. VoxFlow does not use advertising tracking cookies.
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRejectOptional}
                style={{ fontSize: "0.875rem", padding: "9px 16px", borderRadius: "6px" }}
              >
                Reject Optional
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveCustom}
                style={{ fontSize: "0.875rem", padding: "9px 20px", borderRadius: "6px" }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
