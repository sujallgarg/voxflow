import React from "react";
import { Logo } from "./Logo";

interface FooterProps {
  onOpenBetaModal: () => void;
}

const currentYear = new Date().getFullYear();

export const Footer: React.FC<FooterProps> = ({ onOpenBetaModal }) => {
  const handleScroll = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer
      style={{
        background: "#ffffff",
        borderTop: "1px solid var(--border-subtle)",
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
            <Logo size={32} />
            <p
              style={{
                marginTop: "14px",
                fontSize: "0.9375rem",
                color: "#64748b",
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
                style={{ fontSize: "0.85rem", padding: "8px 18px" }}
              >
                Get Early Access →
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
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
                  style={{ fontSize: "0.9rem", color: "#64748b" }}
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#how-it-works");
                  }}
                  style={{ fontSize: "0.9rem", color: "#64748b" }}
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#demo"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScroll("#demo");
                  }}
                  style={{ fontSize: "0.9rem", color: "#64748b" }}
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
                  style={{ fontSize: "0.9rem", color: "#64748b" }}
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Col */}
          <div>
            <h4
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "14px"
              }}
            >
              Contact & Inquiries
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0 }}>
              <li>
                <a
                  href="mailto:support@voxflow.ai?subject=VoxFlow%20Inquiry"
                  style={{ fontSize: "0.9rem", color: "#7e14ff", fontWeight: 600 }}
                >
                  support@voxflow.ai
                </a>
              </li>
              <li style={{ fontSize: "0.85rem", color: "#94a3b8", maxWidth: "220px", lineHeight: 1.5 }}>
                Questions, bug reports or feedback? Email our team directly.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            paddingTop: "24px",
            borderTop: "1px solid #f1edf8",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            fontSize: "0.8125rem",
            color: "#94a3b8"
          }}
        >
          <div>
            © {currentYear} VoxFlow. Speak naturally. Write everywhere.
          </div>

          <div>
            <span>Privacy Policy and Terms of Service will be published upon general release.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
