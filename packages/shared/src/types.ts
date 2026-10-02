export type SupportedLanguage =
  | "en"
  | "hi"
  | "de"
  | "es"
  | "fr";

export interface VoxFlowRequest {
  transcript: string;
  context?: string;
  targetLanguage?: SupportedLanguage;
}

export interface VoxFlowResponse {
  text: string;
  detectedLanguages?: SupportedLanguage[];
}