import { groq, DEFAULT_CHAT_MODEL } from "./groq.client.js";

export interface ContextResult {
  audience: string;
  communicationType: string;
  tone: string;
  formality: string;
  likelyChannel: string;
  purpose: string;
  confidence: number;
}

export async function detectContext(
  transcript: string
): Promise<ContextResult> {
  if (!transcript || !transcript.trim()) {
    throw new Error("Transcript is required for context detection.");
  }

  try {
    const response = await groq.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      temperature: 0,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: `You are VoxFlow's communication context detection engine.

Analyze the user's spoken transcript.
Infer the recipient audience, communication type, tone, formality, likely channel, and purpose.

Rules:
1. audience: e.g. "colleague", "client", "friend", "executive", "team", "support"
2. communicationType: e.g. "professional", "casual", "technical", "inquiry", "update"
3. tone: e.g. "direct", "friendly", "formal", "urgent", "collaborative"
4. formality: "formal" | "neutral" | "casual"
5. likelyChannel: "email" | "chat" | "document" | "social" | "ticket"
6. purpose: Short summary of what this message accomplishes
7. confidence: float between 0.0 and 1.0
8. Return ONLY valid JSON in this exact structure:

{
  "audience": "colleague",
  "communicationType": "professional",
  "tone": "friendly",
  "formality": "neutral",
  "likelyChannel": "chat",
  "purpose": "Status update",
  "confidence": 0.95
}`
        },
        {
          role: "user",
          content: transcript
        }
      ]
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty context detection response.");
    }

    const result = JSON.parse(content);

    return {
      audience: result.audience || "general",
      communicationType: result.communicationType || "general",
      tone: result.tone || "neutral",
      formality: result.formality || "neutral",
      likelyChannel: result.likelyChannel || "general",
      purpose: result.purpose || "communication",
      confidence: typeof result.confidence === "number" ? result.confidence : 0.9
    };
  } catch (error: any) {
    console.error("Context detection error:", error);
    const msg = error?.message || "Failed to detect communication context.";
    throw new Error(`Context detection failed: ${msg}`);
  }
}