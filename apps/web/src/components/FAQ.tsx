import React, { useState } from "react";

export const FAQ: React.FC = () => {
  const faqData = [
    {
      id: "what-is-voxflow",
      q: "What is VoxFlow?",
      a: "VoxFlow is an AI voice input tool that converts natural speech into structured, context-aware text in your preferred language. Rather than raw dictation, it refines your spoken phrasing to fit your destination tone and format."
    },
    {
      id: "how-does-it-work",
      q: "How does it work?",
      a: "When you speak, VoxFlow captures your audio, transcribes the speech, detects language and communication context, and generates polished text that can be inserted directly into web input fields."
    },
    {
      id: "which-languages-supported",
      q: "Which languages are supported?",
      a: "VoxFlow supports major global languages (including English, Hindi, Spanish, French, German, and Portuguese) and naturally handles conversational code-switching (such as Hinglish or Spanglish) without manual mode toggling."
    },
    {
      id: "where-can-i-use-it",
      q: "Where can I use it?",
      a: "VoxFlow is designed as a browser extension that operates across websites where you write, including webmail, docs, spreadsheets, customer support tools, and messaging platforms."
    },
    {
      id: "how-do-i-get-access",
      q: "How do I get access?",
      a: "VoxFlow is currently in open public beta. You can sign up using the 'Get Started' button to receive beta extension releases and test the product for free."
    },
    {
      id: "how-is-data-handled",
      q: "How is my audio and data handled?",
      a: "Audio recordings and generated text are processed exclusively to perform speech transcription and contextual text generation. We do not sell user audio or monetize recordings."
    }
  ];

  const [openId, setOpenId] = useState<string | null>("what-is-voxflow");

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq" className="section-spacing" style={{ background: "#ffffff" }}>
      <div className="container" style={{ maxWidth: "800px" }}>
        <div className="section-title-wrap">
          <span className="badge">FAQ</span>
          <h2>Frequently Asked Questions</h2>
          <p>
            Common questions about VoxFlow capabilities, languages, access, and privacy.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {faqData.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="card-premium"
                style={{
                  background: "#ffffff",
                  overflow: "hidden",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px"
                }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                  onClick={() => toggleAccordion(item.id)}
                  style={{
                    width: "100%",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    textAlign: "left",
                    background: "transparent",
                    color: "#111111",
                    cursor: "pointer"
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#111111"
                    }}
                  >
                    {item.q}
                  </span>

                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      background: "#f5f5f5",
                      color: "#111111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 600,
                      flexShrink: 0,
                      transition: "transform 0.15s ease",
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
                      padding: "0 20px 18px 20px",
                      fontSize: "0.875rem",
                      lineHeight: 1.6,
                      color: "#666666",
                      borderTop: "1px solid #f5f5f5"
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
