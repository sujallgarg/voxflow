export interface LanguageOption {
  id: string;
  name: string;
  type: "auto" | "mixed" | "standard";
  nativeSample?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: "auto", name: "Auto (Contextual)", type: "auto" },
  { id: "hinglish", name: "Hinglish (Hindi + English)", type: "mixed" },
  { id: "spanglish", name: "Spanglish (Spanish + English)", type: "mixed" },
  { id: "denglish", name: "Denglish (German + English)", type: "mixed" },
  { id: "franglais", name: "Franglais (French + English)", type: "mixed" },
  { id: "tanglish", name: "Tanglish (Tamil + English)", type: "mixed" },
  { id: "manglish", name: "Manglish (Malayalam + English)", type: "mixed" },
  { id: "english", name: "English", type: "standard" },
  { id: "hindi", name: "Hindi (हिन्दी)", type: "standard" },
  { id: "spanish", name: "Spanish (Español)", type: "standard" },
  { id: "french", name: "French (Français)", type: "standard" },
  { id: "german", name: "German (Deutsch)", type: "standard" },
  { id: "japanese", name: "Japanese (日本語)", type: "standard" },
  { id: "korean", name: "Korean (한국어)", type: "standard" },
  { id: "chinese", name: "Chinese (中文)", type: "standard" },
  { id: "italian", name: "Italian (Italiano)", type: "standard" },
  { id: "portuguese", name: "Portuguese (Português)", type: "standard" },
  { id: "arabic", name: "Arabic (العربية)", type: "standard" },
  { id: "bengali", name: "Bengali (বাংলা)", type: "standard" },
  { id: "tamil", name: "Tamil (தமிழ்)", type: "standard" },
  { id: "telugu", name: "Telugu (తెలుగు)", type: "standard" },
  { id: "marathi", name: "Marathi (मराठी)", type: "standard" },
  { id: "gujarati", name: "Gujarati (ગુજરાતી)", type: "standard" },
  { id: "punjabi", name: "Punjabi (ਪੰਜਾਬੀ)", type: "standard" },
  { id: "urdu", name: "Urdu (اردو)", type: "standard" },
  { id: "russian", name: "Russian (Русский)", type: "standard" },
  { id: "dutch", name: "Dutch (Nederlands)", type: "standard" },
  { id: "swedish", name: "Swedish (Svenska)", type: "standard" },
  { id: "turkish", name: "Turkish (Türkçe)", type: "standard" },
  { id: "vietnamese", name: "Vietnamese (Tiếng Việt)", type: "standard" },
  { id: "indonesian", name: "Indonesian (Bahasa)", type: "standard" }
];
