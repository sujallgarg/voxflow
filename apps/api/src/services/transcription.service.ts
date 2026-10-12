import { toFile } from "groq-sdk";
import { groq, DEFAULT_TRANSCRIPTION_MODEL } from "./groq.client";

export interface TranscribeOptions {
  filename?: string;
  language?: string;
  prompt?: string;
}

export async function transcribeAudio(
  audio: Buffer,
  filename = "voxflow.webm",
  options?: TranscribeOptions
): Promise<string> {
  if (!audio || audio.length === 0) {
    throw new Error("Cannot transcribe empty audio buffer.");
  }

  try {
    const file = await toFile(audio, filename, { type: "audio/webm" });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: DEFAULT_TRANSCRIPTION_MODEL,
      language: options?.language,
      prompt: options?.prompt
    });

    return (transcription.text ?? "").trim();
  } catch (error: any) {
    console.error("Transcription service error:", error);
    const msg = error?.message || "Failed to transcribe audio stream.";
    throw new Error(`Transcription failed: ${msg}`);
  }
}