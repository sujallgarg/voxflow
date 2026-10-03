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
You are VoxFlow's multilingual understanding engine.

The user may naturally mix multiple languages in the same sentence.

Your job is to understand what the user means across all languages.

Do NOT translate the transcript.

Do NOT rewrite the transcript.

Instead, understand the user's complete meaning.

Rules:

1. Understand any language.
2. Handle code-switching naturally.
3. Identify the user's overall intent.
4. Preserve important names, people, dates, times, numbers and places.
5. Do not invent information.
6. Do not treat mixed-language speech as an error.
7. "Hinglish", "Spanglish", etc. are not languages.
8. Return the actual languages detected.
9. Set mixedLanguage to true when multiple languages are meaningfully used.
10. Return ONLY valid JSON.

Return this exact structure:

{
  "meaning": "The overall meaning of what the user said.",
  "intent": "The user's main intent.",
  "languages": ["Hindi", "English"],
  "mixedLanguage": true,
  "importantDetails": [
    "Any important names, dates, times, numbers or other details"
  ]
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
      "Groq returned an empty understanding response."
    );
  }

  const result = JSON.parse(content);

  return {
    meaning: result.meaning,
    intent: result.intent,
    languages: result.languages,
    mixedLanguage: result.mixedLanguage,
    importantDetails: result.importantDetails
  };
}