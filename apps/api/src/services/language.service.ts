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

export interface LanguageResult {
  primaryLanguage: string;
  languages: string[];
  mixedLanguage: boolean;
}

export async function detectLanguage(
  transcript: string
): Promise<LanguageResult> {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: `You are VoxFlow's language detection engine.

Analyze the transcript below.

Your job is ONLY to identify the languages present.

Rules:

1. Detect any language in the world.
2. Do not limit yourself to a predefined language list.
3. Return the common English name of each language.
4. If multiple languages are meaningfully used, include all of them.
5. Set mixedLanguage to true when multiple languages are used.
6. Do not translate the transcript.
7. Do not rewrite the transcript.
8. Do not guess a language if there is not enough evidence.
9. For code-switching such as Hindi + English, return:
   ["Hindi", "English"]
10. Do not create artificial languages such as "Hinglish".
11. primaryLanguage should be the dominant language.
12. Return ONLY valid JSON.

Required JSON format:

{
  "primaryLanguage": "English",
  "languages": ["English"],
  "mixedLanguage": false
}`
      },
      {
        role: "user",
        content: transcript
      }
    ],
    response_format: {
      type: "json_object"
    }
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Language detection returned an empty response.");
  }

  const result = JSON.parse(content);

  return {
    primaryLanguage: result.primaryLanguage,
    languages: result.languages,
    mixedLanguage: Boolean(result.mixedLanguage)
  };
}