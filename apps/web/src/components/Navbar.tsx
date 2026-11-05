import React, { useState, useEffect, useRef } from "react";
import { Logo } from "./Logo";
import { useAuth } from "../lib/authContext";
import { PremiumBadge } from "./billing/PremiumBadge";

interface NavbarProps {
  onOpenBetaModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBetaModal: _onOpenBetaModal }) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer and dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          menuButtonRef.current?.focus();
        }
        if (accountDropdownOpen) {
          setAccountDropdownOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, accountDropdownOpen]);

  const navLinks = [
    { label: "Product", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    ...(user ? [{ label: "Meetings", href: "#/meetings" }] : [])
  ];

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href.startsWith("#/")) {
      // route hash
      setMobileMenuOpen(false);
      return;
    }
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
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.hash) {
                window.location.hash = "";
              }
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
            aria-label="VoxFlow Home"
          >
            <Logo size={28} />
          </a>
        </div>

        {/* Center: Navigation Links */}
        <nav
          className="desktop-nav"
          style={{
            alignItems: "center",
            gap: "32px"
          }}
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
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

        {/* Right: Authenticated or Logged Out CTAs */}
        {user ? (
          <div
            className="desktop-cta"
            style={{
              alignItems: "center",
              gap: "12px"
            }}
          >
            <a
              href="#/meetings"
              className="btn-primary"
              style={{
                padding: "8px 16px",
                fontSize: "0.875rem",
                borderRadius: "6px",
                textDecoration: "none"
              }}
            >
              Open Dashboard
            </a>

            {/* Account Menu Dropdown */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                aria-expanded={accountDropdownOpen}
                aria-haspopup="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#111111",
                  background: "#f5f5f5",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  cursor: "pointer",
                  maxWidth: "180px"
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={user.email}
                >
                  {user.name || user.email?.split("@")[0] || "Account"}
                </span>
                <PremiumBadge size="sm" />
                <span style={{ fontSize: "10px", color: "#666666" }}>▼</span>
              </button>

              {accountDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: "220px",
                    background: "#ffffff",
                    border: "1px solid #e5e5e5",
                    borderRadius: "8px",
                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                    padding: "8px 0",
                    zIndex: 100
                  }}
                >
                  <div
                    style={{
                      padding: "8px 16px",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: "0.75rem",
                      color: "#666666"
                    }}
                  >
                    Signed in as
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#111111",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                      title={user.email}
                    >
                      {user.email}
                    </div>
                  </div>

                  <a
                    href="#/meetings"
                    onClick={() => setAccountDropdownOpen(false)}
                    style={{
                      display: "block",
                      padding: "8px 16px",
                      fontSize: "0.875rem",
                      color: "#111111",
                      textDecoration: "none"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Meetings Workspace
                  </a>

                  <a
                    href="#/billing"
                    onClick={() => setAccountDropdownOpen(false)}
                    style={{
                      display: "block",
                      padding: "8px 16px",
                      fontSize: "0.875rem",
                      color: "#111111",
                      textDecoration: "none"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Billing & Subscription
                  </a>

                  <div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />

                  <button
                    type="button"
                    onClick={() => {
                      setAccountDropdownOpen(false);
                      signOut();
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 16px",
                      fontSize: "0.875rem",
                      color: "#dc2626",
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="desktop-cta"
            style={{
              alignItems: "center",
              gap: "12px"
            }}
          >
            <a
              href="#/login"
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "#111111",
                textDecoration: "none",
                padding: "8px 14px",
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
            minWidth: "44px",
            minHeight: "44px",
            borderRadius: "6px",
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            color: "#111111",
            cursor: "pointer",
            fontSize: "1.2rem"
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
          style={{
            position: "absolute",
            top: "68px",
            left: 0,
            right: 0,
            background: "#ffffff",
            borderBottom: "1px solid #e5e5e5",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
            padding: "20px 24px 28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            zIndex: 49
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                style={{
                  fontSize: "1rem",
                  fontWeight: 500,
                  color: "#111111",
                  textDecoration: "none",
                  padding: "6px 0"
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div
            style={{
              borderTop: "1px solid #e5e5e5",
              paddingTop: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
          >
            {user ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#666666" }}>
                    {user.email}
                  </span>
                  <PremiumBadge size="sm" />
                </div>
                <a
                  href="#/meetings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary"
                  style={{ width: "100%", textAlign: "center", padding: "11px" }}
                >
                  Open Dashboard
                </a>
                <a
                  href="#/billing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-secondary"
                  style={{ width: "100%", textAlign: "center", padding: "11px" }}
                >
                  Billing
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    color: "#dc2626",
                    background: "#fef2f2",
                    borderRadius: "6px",
                    fontWeight: 500,
                    fontSize: "0.875rem"
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
                  className="btn-secondary"
                  style={{ width: "100%", textAlign: "center", padding: "11px" }}
                >
                  Log in
                </a>
                <a
                  href="#/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary"
                  style={{ width: "100%", textAlign: "center", padding: "11px" }}
                >
                  Get Started
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
