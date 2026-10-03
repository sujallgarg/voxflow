import "dotenv/config";
import Groq, { toFile } from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error(
    "GROQ_API_KEY is missing. Add it to apps/api/.env"
  );
}

const groq = new Groq({
  apiKey
});

export async function transcribeAudio(
  audio: Buffer,
  filename = "voxflow.webm"
): Promise<string> {
  const file = await toFile(audio, filename, { type: "audio/webm" });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo"
  });

  return transcription.text ?? "";
}