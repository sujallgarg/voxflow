import React, { useState } from "react";

export const FAQ: React.FC = () => {
  const faqData = [
    {
      id: "what-is-voxflow",
      q: "What is VoxFlow?",
      a: "VoxFlow is an AI-powered voice input tool that converts natural speech into clear, context-aware text in your preferred language. Instead of basic speech-to-text dictation, it structures your spoken ideas and adapts them to the tone and format suitable for your target destination."
    },
    {
      id: "how-does-it-work",
      q: "How does it work?",
      a: "When you speak, VoxFlow captures your audio, transcribes the speech, detects language and communication context (such as tone, recipient, and channel), and generates polished, ready-to-use text that can be inserted directly into input fields on the web."
    },
    {
      id: "which-languages-supported",
      q: "Which languages are supported?",
      a: "VoxFlow supports major global languages (including English, Hindi, Spanish, French, German, and Portuguese) and naturally handles conversational code-switching (such as Hinglish or Spanglish) so you can speak without rigid language switching."
    },
    {
      id: "where-can-i-use-it",
      q: "Where can I use it?",
      a: "VoxFlow is built as a Chrome extension designed to work across web applications where you write, including webmail, team messaging, document editors, project management tools, and social platforms."
    },
    {
      id: "how-do-i-get-access",
      q: "How do I get access?",
      a: "VoxFlow is currently available in preview. You can request early access by clicking 'Get Early Access' on this site to join our beta invite list and receive extension installation packages."
    },
    {
      id: "how-is-data-handled",
      q: "How is my audio and data handled?",
      a: "Audio recordings and generated text are processed solely to perform your requested transcription and contextual writing tasks. We do not sell user audio or monetize personal recordings."
    }
  ];

  const [openId, setOpenId] = useState<string | null>("what-is-voxflow");

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq" className="section-spacing">
      <div className="container" style={{ maxWidth: "860px" }}>
        <div className="section-title-wrap">
          <span className="badge badge-glow">Got Questions?</span>
          <h2>Frequently Asked Questions</h2>
          <p>
            Learn more about how VoxFlow operates, supported languages, privacy,
            and extension capabilities.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {faqData.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="card-premium"
                style={{
                  background: "#ffffff",
                  overflow: "hidden",
                  transition: "all 0.2s ease"
                }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                  onClick={() => toggleAccordion(item.id)}
                  style={{
                    width: "100%",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    textAlign: "left",
                    background: "transparent",
                    color: "#0f172a"
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: isOpen ? "#7e14ff" : "#0f172a",
                      transition: "color 0.2s ease"
                    }}
                  >
                    {item.q}
                  </span>

                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: isOpen ? "#f3e8ff" : "#f8f6fc",
                      color: isOpen ? "#7e14ff" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      fontWeight: 600,
                      flexShrink: 0,
                      transition: "transform 0.25s ease",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)"
                    }}
                  >
                    +
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${item.id}`}
                    style={{
                      padding: "0 24px 22px 24px",
                      fontSize: "0.9375rem",
                      lineHeight: 1.65,
                      color: "#475569",
                      borderTop: "1px solid #faf5ff"
                    }}
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
