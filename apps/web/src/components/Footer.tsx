import React from "react";
import { Logo } from "./Logo";

interface FooterProps {
  onOpenBetaModal: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToRefunds?: () => void;
  onNavigateToCookies?: () => void;
  onOpenCookieSettings?: () => void;
}

const currentYear = new Date().getFullYear();

export const Footer: React.FC<FooterProps> = ({
  onOpenBetaModal,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToRefunds,
  onNavigateToCookies,
  onOpenCookieSettings
}) => {
  const handleScroll = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer
      style={{
        background: "#ffffff",
        borderTop: "1px solid #e5e5e5",
        paddingTop: "48px",
        paddingBottom: "36px"
      }}
    >
      <div className="container">
        {/* Main Footer Row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "36px",
            marginBottom: "40px"
          }}
        >
          {/* Brand Col */}
          <div style={{ maxWidth: "340px" }}>
            <Logo size={28} />
            <p
              style={{
                marginTop: "14px",
                fontSize: "0.875rem",
                color: "#666666",
                lineHeight: 1.6
              }}
            >
              Speak naturally. Write everywhere. An AI voice input tool that turns
              spoken thoughts into clear, context-aware text across the web.
            </p>
            <div style={{ marginTop: "18px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenBetaModal}
                style={{ fontSize: "0.8125rem", padding: "8px 16px", borderRadius: "6px" }}
              >
                Get Started
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#111111",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "14px"
              }}
            >
              Navigation
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0 }}>
              <li>
                <a
                  href="#features"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#features");
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Product
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#how-it-works");
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#pricing");
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href="#demo"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#demo");
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Interactive Demo
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#faq");
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Col */}
          <div>
            <h4
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#111111",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "14px"
              }}
            >
              Legal & Privacy
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0 }}>
              <li>
                <a
                  href="#/privacy"
                  onClick={(e) => {
                    if (onNavigateToPrivacy) {
                      e.preventDefault();
                      onNavigateToPrivacy();
                    }
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#/terms"
                  onClick={(e) => {
                    if (onNavigateToTerms) {
                      e.preventDefault();
                      onNavigateToTerms();
                    }
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="#/cookies"
                  onClick={(e) => {
                    if (onNavigateToCookies) {
                      e.preventDefault();
                      onNavigateToCookies();
                    }
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Cookie Policy
                </a>
              </li>
              <li>
                <a
                  href="#/refunds"
                  onClick={(e) => {
                    if (onNavigateToRefunds) {
                      e.preventDefault();
                      onNavigateToRefunds();
                    }
                  }}
                  style={{ fontSize: "0.875rem", color: "#666666", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Refund Policy
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenCookieSettings}
                  style={{
                    fontSize: "0.875rem",
                    color: "#111111",
                    fontWeight: 500,
                    textAlign: "left",
                    padding: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  Cookie Settings
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Col */}
          <div>
            <h4
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#111111",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "14px"
              }}
            >
              Contact
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0 }}>
              <li>
                <a
                  href="mailto:support@voxflow.ai?subject=VoxFlow%20Inquiry"
                  style={{ fontSize: "0.875rem", color: "#111111", fontWeight: 500, textDecoration: "none" }}
                >
                  support@voxflow.ai
                </a>
              </li>
              <li style={{ fontSize: "0.8125rem", color: "#666666", maxWidth: "220px", lineHeight: 1.5 }}>
                Product inquiries, bug reports, and beta feedback.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            paddingTop: "24px",
            borderTop: "1px solid #e5e5e5",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            fontSize: "0.8125rem",
            color: "#666666"
          }}
        >
          <div>
            © {currentYear} VoxFlow. Speak naturally. Write everywhere.
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <a
              href="#/privacy"
              onClick={(e) => {
                if (onNavigateToPrivacy) {
                  e.preventDefault();
                  onNavigateToPrivacy();
                }
              }}
              style={{ color: "#666666", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href="#/terms"
              onClick={(e) => {
                if (onNavigateToTerms) {
                  e.preventDefault();
                  onNavigateToTerms();
                }
              }}
              style={{ color: "#666666", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
            >
              Terms of Service
            </a>
            <span>•</span>
            <a
              href="#/cookies"
              onClick={(e) => {
                if (onNavigateToCookies) {
                  e.preventDefault();
                  onNavigateToCookies();
                }
              }}
              style={{ color: "#666666", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
            >
              Cookies
            </a>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenCookieSettings}
              style={{ color: "#666666", fontSize: "0.8125rem", padding: 0, background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
            >
              Cookie Settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
