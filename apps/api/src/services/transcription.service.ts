import { toFile } from "groq-sdk";
import { groq, DEFAULT_TRANSCRIPTION_MODEL } from "./groq.client.js";

export interface TranscribeOptions {
  filename?: string;
  language?: string;
  prompt?: string;
  durationSeconds?: number;
}

export interface TranscribeAudioResult {
  text: string;
  durationSeconds: number;
}

export async function transcribeAudioDetailed(
  audio: Buffer,
  filename = "voxflow.webm",
  options?: TranscribeOptions
): Promise<TranscribeAudioResult> {
  if (!audio || audio.length === 0) {
    throw new Error("Cannot transcribe empty audio buffer.");
  }

  try {
    const file = await toFile(audio, filename, { type: "audio/webm" });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: DEFAULT_TRANSCRIPTION_MODEL,
      language: options?.language,
      prompt: options?.prompt,
      response_format: "verbose_json"
    });

    const text = (transcription.text ?? "").trim();
    let durationSeconds = options?.durationSeconds;
    if (durationSeconds === undefined || durationSeconds <= 0) {
      if (typeof (transcription as any).duration === "number" && (transcription as any).duration > 0) {
        durationSeconds = Math.round((transcription as any).duration);
      } else {
        durationSeconds = Math.max(1, Math.round(audio.length / 3200));
      }
    }

    return {
      text,
      durationSeconds
    };
  } catch (error: any) {
    // If verbose_json format is not supported or failed, fallback to default format
    try {
      const file = await toFile(audio, filename, { type: "audio/webm" });
      const transcription = await groq.audio.transcriptions.create({
        file,
        model: DEFAULT_TRANSCRIPTION_MODEL,
        language: options?.language,
        prompt: options?.prompt
      });
      const text = (transcription.text ?? "").trim();
      const durationSeconds = options?.durationSeconds && options.durationSeconds > 0
        ? options.durationSeconds
        : Math.max(1, Math.round(audio.length / 3200));
      return { text, durationSeconds };
    } catch (fallbackErr: any) {
      console.error("Transcription service error:", error);
      const msg = error?.message || "Failed to transcribe audio stream.";
      throw new Error(`Transcription failed: ${msg}`);
    }
  }
}

export async function transcribeAudio(
  audio: Buffer,
  filename = "voxflow.webm",
  options?: TranscribeOptions
): Promise<string> {
  const result = await transcribeAudioDetailed(audio, filename, options);
  return result.text;
}