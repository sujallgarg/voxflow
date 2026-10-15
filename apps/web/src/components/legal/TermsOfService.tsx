import React from "react";

interface TermsOfServiceProps {
  onBackToHome: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBackToHome }) => {
  return (
    <div style={{ background: "#fbf9fe", minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div className="container" style={{ maxWidth: "860px", margin: "0 auto" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: "28px" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onBackToHome}
            style={{ fontSize: "0.875rem", padding: "8px 16px" }}
          >
            ← Back to Home
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
              Legal Documentation
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
              Terms of Service
            </h1>
            <p style={{ fontSize: "0.9375rem", color: "#64748b" }}>
              Last updated: October 15, 2026 | Effective date: October 15, 2026
            </p>
          </header>

          {/* Legal Review Disclaimer */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "32px",
              fontSize: "0.875rem",
              color: "#334155",
              lineHeight: 1.6
            }}
          >
            <strong>Preview Terms:</strong> These Terms of Service govern access to the VoxFlow developer preview and beta releases. Final governing jurisdiction, business entity registration, and formal dispute resolution provisions are flagged for qualified legal counsel approval prior to general commercial launch.
          </div>

          {/* Section 1 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              1. Acceptance of Terms and Eligibility
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              By accessing or using the VoxFlow website, Chrome extension, or API services, you agree to be bound by these Terms of Service. You must be at least 16 years of age (or the age of majority in your jurisdiction) to use VoxFlow.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              2. User Responsibility for Recording and Consent
            </h2>
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
                color: "#92400e",
                fontSize: "0.92rem",
                lineHeight: 1.6
              }}
            >
              <strong>Critical Recording Obligation:</strong> You acknowledge and agree that applicable federal, state, and international wiretapping and privacy laws (including one-party and two-party/all-party consent statutes) require that all participants in a meeting or conversation be informed and explicitly consent to audio recording.
            </div>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              You are solely responsible for obtaining any and all necessary consents from participants before starting any recording session using the VoxFlow Chrome extension or browser tab audio capture. VoxFlow disclaims any liability arising from your failure to obtain required consent.
            </p>
          </section>

          {/* Section 3 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              3. AI-Generated Output and Verification Limitation
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              VoxFlow leverages third-party artificial intelligence models for transcription, intent detection, and summary synthesis. Artificial intelligence systems are probabilistic and can produce errors, omissions, misattributions, or hallucinations.
            </p>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7 }}>
              You acknowledge that AI-generated summaries, action items, and transcripts are provided as drafting aids only. You must review and verify all generated content prior to relying on it for business, contractual, financial, medical, or legal purposes.
            </p>
          </section>

          {/* Section 4 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              4. User Content and Limited License
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              You retain all ownership rights and intellectual property in your voice inputs, speech recordings, notes, and generated text.
            </p>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7 }}>
              You grant VoxFlow only the limited, non-exclusive license necessary to transmit, process, and format your inputs to fulfill your requested transcription and summarization tasks.
            </p>
          </section>

          {/* Section 5 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              5. Acceptable Use and Prohibitions
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              You agree not to misuse VoxFlow. Prohibited actions include:
            </p>
            <ul style={{ paddingLeft: "24px", color: "#475569", fontSize: "0.95rem", lineHeight: 1.7 }}>
              <li>Recording conversations without required legal consent from all participants.</li>
              <li>Attempting to bypass API rate limits, authentication controls, or user isolation mechanisms.</li>
              <li>Reverse-engineering, decompiling, or disassembling the proprietary client extension code.</li>
              <li>Transmitting malware, harmful payloads, or automated scraping scripts against VoxFlow servers.</li>
              <li>Impersonating another user or spoofing authentication tokens or headers.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              6. Service Availability and Modifications
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              VoxFlow is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis during preview testing. We reserve the right to modify, suspend, or discontinue features with or without notice for maintenance, security patches, or architectural upgrades.
            </p>
          </section>

          {/* Section 7 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              7. Disclaimers of Warranties
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7, marginBottom: "12px" }}>
              To the fullest extent permitted by applicable law, VoxFlow expressly disclaims all warranties of any kind, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          {/* Section 8 */}
          <section style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              8. Contact and Inquiries
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.7 }}>
              For legal inquiries regarding these terms, please contact:
              <br />
              <strong style={{ color: "#0f172a" }}>VoxFlow Legal Operations</strong>
              <br />
              Email: <a href="mailto:support@voxflow.ai" style={{ color: "#4f46e5", fontWeight: 600 }}>support@voxflow.ai</a>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};
