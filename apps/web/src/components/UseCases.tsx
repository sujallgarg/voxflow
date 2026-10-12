import React, { useState } from "react";

export const UseCases: React.FC = () => {
  const useCases = [
    {
      id: "emails",
      category: "Work & Leadership",
      title: "Writing Professional Emails",
      icon: "✉️",
      rawSpeech:
        "Yeah please tell Marcus we got the revised statement of work and our legal approved it, so we're ready to sign once they update the commencement date to May 1st.",
      transformedText:
        "Hi Marcus,\n\nWe have reviewed the revised Statement of Work. Our legal team has approved the agreement, and we are ready to proceed with signature once the commencement date is updated to May 1st.\n\nBest regards,"
    },
    {
      id: "messages",
      category: "Team Chat",
      title: "Replying to Fast Messages",
      icon: "💬",
      rawSpeech:
        "Hey team running 5 mins late to the standup go ahead and start without me, I'll update on the billing bug as soon as I hop on.",
      transformedText:
        "Hey team, running about 5 minutes late to standup! Please feel free to kick off without me—I'll share an update on the billing bug as soon as I join."
    },
    {
      id: "social",
      category: "Content & Community",
      title: "Creating Social Media Posts",
      icon: "📱",
      rawSpeech:
        "Just shipped our new extension manifest v3 build, recording audio now persists even if you close the popup window, super proud of the team.",
      transformedText:
        "🚀 Excited to share we just shipped our new Manifest V3 update for VoxFlow! Background audio recording now seamlessly persists even when the popup closes. Huge kudos to the engineering team!"
    },
    {
      id: "docs",
      category: "Knowledge Base",
      title: "Drafting PRDs & Docs",
      icon: "📄",
      rawSpeech:
        "Requirement number one the user can toggle between microphone and tab audio streams without re-authenticating, and fallback gracefully if permission denied.",
      transformedText:
        "### Functional Requirement 1: Dual Audio Stream Capture\n- Users must be able to switch dynamically between microphone input and tab audio streaming without session re-authentication.\n- System must provide clear fallback error handling if stream permissions are denied."
    },
    {
      id: "multilingual",
      category: "Global Teams",
      title: "Communicating Across Languages",
      icon: "🌐",
      rawSpeech:
        "Arey Sunita client ko bata dena ki payment gateway integration ho chuka hai and hum kal staging pe live test karenge.",
      transformedText:
        "Hi Sunita,\n\nPlease update the client that the payment gateway integration is now complete. We will be performing live staging verification tomorrow morning.\n\nThanks!"
    },
    {
      id: "spoken-thoughts",
      category: "Brainstorming",
      title: "Turning Spoken Thoughts into Text",
      icon: "💡",
      rawSpeech:
        "Um so idea for onboarding: instead of a boring video, let them dictate a 5 second greeting and instantly see it formatted into three different email tones.",
      transformedText:
        "**Onboarding Concept: Interactive Voice Playbook**\nInstead of static video tutorials, prompt new users to dictate a 5-second voice greeting. Instantly render the transcription in three distinct tones (Professional, Conversational, Technical) to demonstrate real-time value."
    }
  ];

  const [activeTab, setActiveTab] = useState<string>("emails");
  const selectedCase = useCases.find((c) => c.id === activeTab) || useCases[0];

  return (
    <section id="use-cases" className="section-spacing">
      <div className="container">
        <div className="section-title-wrap">
          <span className="badge badge-glow">Versatile Scenarios</span>
          <h2>Designed for Every Way You Communicate</h2>
          <p>
            Whether dictating an urgent email, drafting notes in Notion, or
            sending quick updates on Slack, VoxFlow adapts tone and structure.
          </p>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "36px"
          }}
        >
          {useCases.map((uc) => (
            <button
              key={uc.id}
              type="button"
              onClick={() => setActiveTab(uc.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "var(--radius-full)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: activeTab === uc.id ? "var(--primary-gradient)" : "var(--bg-card)",
                color: activeTab === uc.id ? "#ffffff" : "#475569",
                border:
                  activeTab === uc.id
                    ? "1px solid transparent"
                    : "1px solid var(--border-subtle)",
                boxShadow: activeTab === uc.id ? "0 4px 16px rgba(126, 20, 255, 0.25)" : "none",
                transition: "all 0.2s ease"
              }}
            >
              <span>{uc.icon}</span>
              <span>{uc.title}</span>
            </button>
          ))}
        </div>

        {/* Detailed Before / After Showcase Card */}
        <div
          className="card-premium"
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            padding: "36px 32px",
            background: "#ffffff"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
              paddingBottom: "16px",
              borderBottom: "1px solid #f1edf8"
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#7e14ff",
                  letterSpacing: "0.06em"
                }}
              >
                {selectedCase.category}
              </span>
              <h3 style={{ fontSize: "1.45rem", fontWeight: 700, color: "#0f172a" }}>
                {selectedCase.title}
              </h3>
            </div>

            <span className="badge badge-emerald">Optimized Tone & Structure</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "24px"
            }}
            className="usecase-columns"
          >
            {/* Raw Speech */}
            <div
              style={{
                background: "#faf9fd",
                borderRadius: "16px",
                border: "1px solid #ece7f8",
                padding: "20px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px"
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#94a3b8"
                  }}
                />
                <strong
                  style={{
                    fontSize: "0.8125rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#64748b"
                  }}
                >
                  Raw Voice Input (Spoken Conversation)
                </strong>
              </div>
              <p
                style={{
                  fontSize: "0.9375rem",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                  color: "#475569"
                }}
              >
                "{selectedCase.rawSpeech}"
              </p>
            </div>

            {/* Transformed */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                border: "1px solid rgba(126, 20, 255, 0.22)",
                boxShadow: "0 4px 20px rgba(126, 20, 255, 0.06)",
                padding: "20px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px"
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981"
                  }}
                />
                <strong
                  style={{
                    fontSize: "0.8125rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#059669"
                  }}
                >
                  Transformed Output (Context-Aware)
                </strong>
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  lineHeight: 1.65,
                  color: "#0f172a",
                  whiteSpace: "pre-line"
                }}
              >
                {selectedCase.transformedText}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 800px) {
          .usecase-columns {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};
