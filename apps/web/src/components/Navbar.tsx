import React, { useState, useEffect } from "react";
import { Logo } from "./Logo";

interface NavbarProps {
  onOpenBetaModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBetaModal }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" }
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
        transition: "all 0.25s ease",
        background: isScrolled
          ? "rgba(255, 255, 255, 0.94)"
          : "rgba(251, 249, 254, 0.7)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: isScrolled
          ? "1px solid rgba(236, 229, 248, 0.8)"
          : "1px solid transparent"
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "72px"
        }}
      >
        {/* Logo */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          style={{ display: "inline-flex", alignItems: "center" }}
          aria-label="VoxFlow Home"
        >
          <Logo size={32} />
        </a>

        {/* Desktop Navigation */}
        <nav
          style={{
            display: "none",
            alignItems: "center",
            gap: "32px"
          }}
          className="desktop-nav"
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
                color: "#475569",
                transition: "color 0.2s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#7e14ff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action CTA */}
        <div
          style={{ display: "none", alignItems: "center", gap: "10px" }}
          className="desktop-cta"
        >
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenBetaModal}
            style={{ padding: "9px 20px", fontSize: "0.875rem" }}
          >
            Get Early Access
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "#f1f0f7",
            border: "none",
            color: "#0f172a",
            cursor: "pointer"
          }}
          className="mobile-toggle"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: "72px",
            left: 0,
            right: 0,
            background: "#ffffff",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "20px 24px 28px",
            boxShadow: "0 20px 30px rgba(15, 23, 42, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#1e293b",
                padding: "8px 0",
                borderBottom: "1px solid #f1f5f9"
              }}
            >
              {link.label}
            </a>
          ))}

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenBetaModal();
            }}
            style={{ width: "100%", padding: "12px", marginTop: "8px" }}
          >
            Get Early Access
          </button>
        </div>
      )}
    </header>
  );
};
