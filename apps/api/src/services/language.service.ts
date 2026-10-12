import { groq, DEFAULT_CHAT_MODEL } from "./groq.client";

export interface LanguageResult {
  primaryLanguage: string;
  languageCode: string;
  languages: string[];
  mixedLanguage: boolean;
  confidence: number;
}

export async function detectLanguage(
  transcript: string
): Promise<LanguageResult> {
  if (!transcript || !transcript.trim()) {
    throw new Error("Transcript is required for language detection.");
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are VoxFlow's multilingual language detection engine.

Analyze the user's spoken transcript.
Your job is to identify all languages present, the primary language, ISO 639-1 language code, and detection confidence.

Rules:
1. Detect any world language (English, Hindi, German, French, Spanish, Portuguese, Italian, Japanese, Korean, Chinese, Arabic, etc.).
2. For mixed-language code-switching (e.g. Hindi mixed with English words, Spanglish, Denglish):
   - Include all detected languages in "languages" array: e.g. ["Hindi", "English"]
   - Set "mixedLanguage": true
3. "primaryLanguage" should be the dominant language.
4. "languageCode" should be the two-letter ISO 639-1 code of the primary language (e.g. "en", "hi", "es", "de", "fr", "ja", "zh", "ar", "pt", "it", etc.).
5. "confidence" should be a float between 0.0 and 1.0 (e.g. 0.98).
6. Return ONLY valid JSON in this exact structure:

{
  "primaryLanguage": "English",
  "languageCode": "en",
  "languages": ["English"],
  "mixedLanguage": false,
  "confidence": 0.98
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
      primaryLanguage: result.primaryLanguage || "English",
      languageCode: result.languageCode || "en",
      languages: Array.isArray(result.languages) && result.languages.length ? result.languages : ["English"],
      mixedLanguage: Boolean(result.mixedLanguage),
      confidence: typeof result.confidence === "number" ? result.confidence : 0.95
    };
  } catch (error: any) {
    console.error("Language detection error:", error);
    const msg = error?.message || "Failed to detect language.";
    throw new Error(`Language detection failed: ${msg}`);
  }
}