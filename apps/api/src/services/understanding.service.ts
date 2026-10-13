import { groq, DEFAULT_CHAT_MODEL } from "./groq.client.js";

export interface UnderstandingResult {
  meaning: string;
  intent: string;
  languages: string[];
  mixedLanguage: boolean;
  importantDetails: string[];
}

export async function understandTranscript(
  transcript: string
): Promise<UnderstandingResult> {
  if (!transcript || !transcript.trim()) {
    throw new Error("Transcript is required for understanding.");
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
          content: `You are VoxFlow's multilingual understanding engine.

The user may naturally mix multiple languages in the same sentence (code-switching).
Your job is to understand what the user means across all languages.
Do NOT translate the transcript literally.
Do NOT rewrite the transcript.
Understand the user's complete meaning, intent, and critical details (names, dates, times, numbers, actions).

Rules:
1. Understand any language and handle code-switching naturally.
2. Identify the user's overall intent.
3. Preserve important names, people, dates, times, numbers, and places in "importantDetails".
4. Do not invent information.
5. Return ONLY valid JSON in this exact structure:

{
  "meaning": "The overall meaning of what the user said.",
  "intent": "The user's main intent.",
  "languages": ["Hindi", "English"],
  "mixedLanguage": true,
  "importantDetails": ["Details here"]
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
      throw new Error("Groq returned an empty understanding response.");
    }

    const result = JSON.parse(content);

    return {
      meaning: result.meaning || "",
      intent: result.intent || "",
      languages: Array.isArray(result.languages) ? result.languages : [],
      mixedLanguage: Boolean(result.mixedLanguage),
      importantDetails: Array.isArray(result.importantDetails) ? result.importantDetails : []
    };
  } catch (error: any) {
    console.error("Understanding service error:", error);
    const msg = error?.message || "Failed to parse meaning and intent.";
    throw new Error(`Understanding failed: ${msg}`);
  }
}