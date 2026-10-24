import React, { useState } from "react";

export const FAQ: React.FC = () => {
  const faqData = [
    {
      id: "what-is-voxflow",
      q: "What is VoxFlow?",
      a: "VoxFlow is an AI voice input tool that converts natural speech into clear, structured, context-aware text in your preferred language. Instead of literal dictation with awkward punctuation commands, VoxFlow understands your communication intent and formats your words to fit your recipient's tone and format."
    },
    {
      id: "which-languages-supported",
      q: "Which languages does it support?",
      a: "VoxFlow supports major global languages (including English, Hindi, Spanish, French, German, and Portuguese) and natively handles conversational code-switching (such as Hinglish or Spanglish) without requiring you to manually toggle language modes."
    },
    {
      id: "where-can-i-use-it",
      q: "Where can I use VoxFlow?",
      a: "VoxFlow runs directly in modern Chromium web browsers. You can use it across any web application where you write, including Gmail, Slack, Google Docs, Notion, customer support dashboards, and web forms."
    },
    {
      id: "how-do-meetings-and-summaries-work",
      q: "How do meetings and summaries work?",
      a: "The VoxFlow Meeting Workspace allows you to record live audio from your discussions directly within your browser. Once recording stops, VoxFlow produces a full chronological transcript, extracts core discussion decisions, and compiles prioritized action items with zero manual note-taking required."
    },
    {
      id: "what-is-included-in-free-and-pro",
      q: "What is included in the Free and Pro plans?",
      a: "The Free plan includes 30 minutes of voice transcription, 100 voice requests, 50 AI text corrections, and 3 meeting summaries per month with 7-day history retention. The Pro plan ($9/month) expands limits to 300 minutes of transcription, 1,000 voice typing requests, 500 AI text corrections, 25 meetings & summaries, fair-use retention, and priority processing."
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
          <span className="badge">Frequently Asked</span>
          <h2>Frequently Asked Questions</h2>
          <p>
            Clear answers about VoxFlow capabilities, language support, meeting intelligence, and pricing plans.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {faqData.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  overflow: "hidden",
                  border: `1px solid ${isOpen ? "#111111" : "#e5e5e5"}`,
                  borderRadius: "8px",
                  transition: "border-color 0.15s ease"
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
                    color: "#111111",
                    cursor: "pointer"
                  }}
                >
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "#111111"
                    }}
                  >
                    {item.q}
                  </span>

                  <span
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      background: isOpen ? "#111111" : "#f5f5f5",
                      color: isOpen ? "#ffffff" : "#111111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "15px",
                      fontWeight: 600,
                      flexShrink: 0,
                      transition: "all 0.15s ease",
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
                      color: "#555555",
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
