export type OutputModeType = "auto" | "language" | "mixed";

export interface OutputMode {
  id: string;
  name: string;
  type: OutputModeType;
  instructions: string;
}

export const AUTO_MODE: OutputMode = {
  id: "auto",
  name: "Auto",
  type: "auto",
  instructions: "Determine the most appropriate language based on conversation context."
};

export const STANDARD_LANGUAGES: string[] = [
  "English",
  "Hindi",
  "German",
  "Portuguese",
  "Spanish",
  "French",
  "Italian",
  "Japanese",
  "Korean",
  "Chinese",
  "Arabic",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Dutch",
  "Russian",
  "Ukrainian",
  "Polish",
  "Turkish",
  "Indonesian",
  "Malay",
  "Thai",
  "Vietnamese",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Greek",
  "Hebrew",
  "Swahili",
  "Persian",
  "Nepali",
  "Kannada",
  "Malayalam",
  "Odia",
  "Assamese",
  "Sinhala",
  "Filipino",
  "Romanian",
  "Czech",
  "Hungarian",
  "Serbian",
  "Croatian",
  "Bulgarian",
  "Slovak",
  "Afrikaans"
];

export const MIXED_LANGUAGE_MODES: OutputMode[] = [
  {
    id: "hinglish",
    name: "Hinglish",
    type: "mixed",
    instructions: "Use a natural conversational mixture of Hindi and English."
  },
  {
    id: "spanglish",
    name: "Spanglish",
    type: "mixed",
    instructions: "Use a natural conversational mixture of Spanish and English."
  },
  {
    id: "denglish",
    name: "Denglish",
    type: "mixed",
    instructions: "Use a natural conversational mixture of German and English."
  },
  {
    id: "franglais",
    name: "Franglais",
    type: "mixed",
    instructions: "Use a natural conversational mixture of French and English."
  },
  {
    id: "tanglish",
    name: "Tanglish",
    type: "mixed",
    instructions: "Use a natural conversational mixture of Tamil and English."
  },
  {
    id: "manglish",
    name: "Manglish",
    type: "mixed",
    instructions: "Use a natural conversational mixture of Malayalam and English."
  }
];

export const OUTPUT_MODES: OutputMode[] = [
  AUTO_MODE,
  ...MIXED_LANGUAGE_MODES,
  ...STANDARD_LANGUAGES.map((name) => ({
    id: name.toLowerCase(),
    name,
    type: "language" as const,
    instructions: `Write naturally in ${name}. Preserve original meaning, tone, and critical details.`
  }))
];

export function getOutputMode(idOrName: string): OutputMode | undefined {
  const query = idOrName.toLowerCase().trim();
  return OUTPUT_MODES.find(
    (mode) => mode.id === query || mode.name.toLowerCase() === query
  );
}

export function isValidTargetLanguage(name: string): boolean {
  if (name === "Auto") return true;
  return OUTPUT_MODES.some(
    (mode) => mode.name.toLowerCase() === name.toLowerCase()
  );
}
