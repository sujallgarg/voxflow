import React, { useState, useEffect, useRef } from "react";
import { Logo } from "./Logo";
import { useAuth } from "../lib/authContext";

interface NavbarProps {
  onOpenBetaModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBetaModal: _onOpenBetaModal }) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: "Product", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" }
  ];

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: "1px solid #e5e5e5",
        height: "68px"
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%"
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              borderRadius: "6px"
            }}
            aria-label="VoxFlow Home"
          >
            <Logo size={30} />
          </a>
        </div>

        {/* Center: Essential Navigation Links */}
        <nav
          className="desktop-nav"
          style={{
            alignItems: "center",
            gap: "36px"
          }}
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "#666666",
                textDecoration: "none",
                transition: "color 0.15s ease",
                padding: "6px 2px"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right: Authenticated or Log in & Get Started */}
        {user ? (
          <div
            className="desktop-cta"
            style={{
              alignItems: "center",
              gap: "16px"
            }}
          >
            <a
              href="#/meetings"
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "#111111",
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Meetings
            </a>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "#666666",
                maxWidth: "160px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
              title={user.email}
            >
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              style={{
                padding: "7px 14px",
                fontSize: "0.8125rem",
                fontWeight: 500,
                backgroundColor: "#ffffff",
                color: "#111111",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "border-color 0.15s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#111111")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
            >
              Log out
            </button>
          </div>
        ) : (
          <div
            className="desktop-cta"
            style={{
              alignItems: "center",
              gap: "16px"
            }}
          >
            <a
              href="#/login"
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "#111111",
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Log in
            </a>

            <a
              href="#/signup"
              className="btn-primary"
              style={{
                padding: "9px 18px",
                fontSize: "0.875rem",
                borderRadius: "6px",
                textDecoration: "none",
                display: "inline-block"
              }}
            >
              Get Started
            </a>
          </div>
        )}

        {/* Mobile Menu Toggle Button */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-panel"
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            borderRadius: "6px",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            color: "#111111",
            cursor: "pointer",
            fontSize: "16px"
          }}
          className="mobile-toggle"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Drawer Panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-panel"
          ref={drawerRef}
          role="region"
          aria-label="Mobile Navigation"
          style={{
            position: "absolute",
            top: "68px",
            left: 0,
            right: 0,
            background: "#ffffff",
            borderBottom: "1px solid #e5e5e5",
            padding: "20px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.04)"
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "#111111",
                padding: "8px 0",
                textDecoration: "none",
                borderBottom: "1px solid #f5f5f5"
              }}
            >
              {link.label}
            </a>
          ))}

          {user ? (
            <>
              <a
                href="#/meetings"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  color: "#111111",
                  padding: "8px 0",
                  textDecoration: "none"
                }}
              >
                Meetings
              </a>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "#666666",
                  padding: "4px 0"
                }}
              >
                Signed in as: <strong>{user.email}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "6px",
                  backgroundColor: "#ffffff",
                  color: "#111111",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a
                href="#/login"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  color: "#666666",
                  padding: "8px 0",
                  textDecoration: "none"
                }}
              >
                Log in
              </a>

              <a
                href="#/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary"
                style={{
                  display: "block",
                  textAlign: "center",
                  width: "100%",
                  padding: "12px",
                  marginTop: "4px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  boxSizing: "border-box"
                }}
              >
                Get Started
              </a>
            </>
          )}
        </div>
      )}
    </header>
  );
};
