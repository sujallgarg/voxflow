import { detectLanguage, LanguageResult } from "./language.service.js";
import { understandTranscript, UnderstandingResult } from "./understanding.service.js";
import { detectContext, ContextResult } from "./context.service.js";
import { transformTranscript, TransformationResult } from "./transformation.service.js";

export interface ProcessPipelineInput {
  transcript: string;
  targetLanguage?: string;
}

export interface ProcessPipelineResult {
  transcript: string;
  language: LanguageResult;
  understanding: UnderstandingResult;
  context: ContextResult;
  transformation: TransformationResult;
}

export async function processVoicePipeline(
  input: ProcessPipelineInput
): Promise<ProcessPipelineResult> {
  const { transcript, targetLanguage } = input;

  if (!transcript || !transcript.trim()) {
    throw new Error("Transcript is required for voice pipeline processing.");
  }

  // Run language detection, understanding, and context detection in parallel for speed!
  const [language, understanding, context] = await Promise.all([
    detectLanguage(transcript),
    understandTranscript(transcript),
    detectContext(transcript)
  ]);

  // Then transform using the rich contextual parameters
  const transformation = await transformTranscript({
    transcript,
    meaning: understanding.meaning,
    intent: understanding.intent,
    audience: context.audience,
    communicationType: context.communicationType,
    tone: context.tone,
    formality: context.formality,
    likelyChannel: context.likelyChannel,
    purpose: context.purpose,
    targetLanguage: targetLanguage && targetLanguage !== "Auto" ? targetLanguage : undefined
  });

  return {
    transcript,
    language,
    understanding,
    context,
    transformation
  };
}
