import React from "react";

interface CookiePolicyProps {
  onBackToHome: () => void;
  onOpenCookieSettings: () => void;
}

export const CookiePolicy: React.FC<CookiePolicyProps> = ({
  onBackToHome,
  onOpenCookieSettings
}) => {
  return (
    <div style={{ background: "#fbf9fe", minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div className="container" style={{ maxWidth: "860px", margin: "0 auto" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onBackToHome}
            style={{ fontSize: "0.875rem", padding: "8px 16px" }}
          >
            ← Back to Home
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={onOpenCookieSettings}
            style={{ fontSize: "0.875rem", padding: "8px 16px" }}
          >
            Manage Cookie Settings
          </button>
        </div>

        {/* Legal Document Container */}
        <article
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
            padding: "48px 40px",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)"
          }}
        >
          {/* Header */}
          <header style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "24px", marginBottom: "32px" }}>
            <span className="badge badge-glow" style={{ marginBottom: "12px" }}>
              Privacy & Consent
            </span>
            <h1
              style={{
                fontSize: "2.25rem",
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.2,
                marginBottom: "12px"
              }}
            >
              Cookie & Local Storage Policy
            </h1>
            <p style={{ fontSize: "0.9375rem", color: "#64748b" }}>
              Last updated: October 15, 2026 | Effective date: October 15, 2026
            </p>
          </header>

          {/* Intro */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              1. What Are Cookies and Local Storage?
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7 }}>
              Cookies and browser local storage are standard web technologies that allow websites and web applications to store information on your device. VoxFlow prioritizes user privacy: we do not employ advertising tracking pixels, cross-site trackers, or third-party behavioral analytics cookies.
            </p>
          </section>

          {/* Audit Table */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "16px" }}>
              2. Complete Storage Audit Inventory
            </h2>
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#334155" }}>
                    <th style={{ padding: "12px 16px" }}>Key Name</th>
                    <th style={{ padding: "12px 16px" }}>Type</th>
                    <th style={{ padding: "12px 16px" }}>Category</th>
                    <th style={{ padding: "12px 16px" }}>Purpose & Lifespan</th>
                  </tr>
                </thead>
                <tbody style={{ color: "#475569" }}>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>voxflow_user_session</td>
                    <td style={{ padding: "12px 16px" }}>localStorage</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>Strictly Necessary</span></td>
                    <td style={{ padding: "12px 16px" }}>Stores your active user ID session profile. Persistent until cleared.</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>voxflow_user_meetings_*</td>
                    <td style={{ padding: "12px 16px" }}>localStorage</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>Strictly Necessary</span></td>
                    <td style={{ padding: "12px 16px" }}>Caches meeting notes and transcripts locally to provide instant workspace loading.</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>voxflow_user_transcripts_*</td>
                    <td style={{ padding: "12px 16px" }}>localStorage</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>Strictly Necessary</span></td>
                    <td style={{ padding: "12px 16px" }}>Stores voice typing history on your device for user retrieval.</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>voxflow_waitlist_emails</td>
                    <td style={{ padding: "12px 16px" }}>localStorage</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>Strictly Necessary</span></td>
                    <td style={{ padding: "12px 16px" }}>Offline fallback cache when server is disconnected during waitlist signup.</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>voxflow_cookie_consent_v1</td>
                    <td style={{ padding: "12px 16px" }}>localStorage</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>Strictly Necessary</span></td>
                    <td style={{ padding: "12px 16px" }}>Stores your cookie consent decisions and timestamp.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Categories */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              3. Consent Categories
            </h2>
            <ul style={{ paddingLeft: "24px", color: "#475569", fontSize: "0.95rem", lineHeight: 1.7 }}>
              <li style={{ marginBottom: "10px" }}>
                <strong>Strictly Necessary Storage:</strong> Required for the web application to function properly. This includes session management, local meeting caching, and consent recording. These cannot be disabled.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Analytics & Performance:</strong> Measures site performance and technical diagnostic metrics. Currently, no third-party analytics trackers are active.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Functional Preferences:</strong> Remembers your language defaults and editor display preferences.
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Marketing & Advertising:</strong> Used for targeted advertisements. VoxFlow does not use advertising cookies.
              </li>
            </ul>
          </section>

          {/* Managing Preferences */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              4. How to Manage or Withdraw Consent
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "16px" }}>
              You have the right to customize or withdraw your consent at any time. Clicking the button below allows you to adjust your choices immediately:
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenCookieSettings}
              style={{ fontSize: "0.95rem", padding: "12px 24px" }}
            >
              Open Cookie Settings
            </button>
          </section>

          {/* Contact */}
          <section>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              5. Questions
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7 }}>
              If you have any questions about our use of storage technologies, please contact:
              <br />
              Email: <a href="mailto:support@voxflow.ai" style={{ color: "#4f46e5", fontWeight: 600 }}>support@voxflow.ai</a>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};
