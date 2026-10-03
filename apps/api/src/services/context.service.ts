import "dotenv/config";
import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error(
    "GROQ_API_KEY is missing. Add it to apps/api/.env"
  );
}

const groq = new Groq({
  apiKey
});

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
  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",

    temperature: 0,

    response_format: {
      type: "json_object"
    },

    messages: [
      {
        role: "system",
        content: `
You are VoxFlow's context detection engine.

Your job is to understand the communication context
behind the user's spoken input.

The user may speak naturally and may mix multiple languages.

Determine:

1. Who is the likely audience?
2. What type of communication is this?
3. What tone is appropriate?
4. How formal should the communication be?
5. What channel is most likely?
6. What is the purpose of the message?

Important:

- Do NOT rewrite the user's message.
- Do NOT translate the message.
- Do NOT invent facts.
- Do not assume a specific platform unless there is evidence.
- If the audience is unclear, use "unknown".
- If the channel is unclear, use "unknown".
- Confidence must be between 0 and 1.
- Return ONLY valid JSON.

Possible audience examples:
- friend
- family
- colleague
- manager
- client
- customer
- prospect
- public
- unknown

Possible communicationType examples:
- personal
- professional
- business
- customer_support
- sales
- marketing
- social
- unknown

Possible tone examples:
- casual
- friendly
- professional
- formal
- persuasive
- apologetic
- informative
- unknown

Possible formality values:
- casual
- neutral
- professional
- formal
- unknown

Possible channel examples:
- email
- chat
- social_media
- sms
- meeting
- unknown

Return exactly:

{
  "audience": "client",
  "communicationType": "business",
  "tone": "professional",
  "formality": "professional",
  "likelyChannel": "email",
  "purpose": "Inform the client about a meeting",
  "confidence": 0.92
}
        `
      },
      {
        role: "user",
        content: transcript
      }
    ]
  });

  const content =
    response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty context response."
    );
  }

  const result = JSON.parse(content);

  return {
    audience: result.audience,
    communicationType:
      result.communicationType,
    tone: result.tone,
    formality: result.formality,
    likelyChannel: result.likelyChannel,
    purpose: result.purpose,
    confidence: result.confidence
  };
}