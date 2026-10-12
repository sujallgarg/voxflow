import "dotenv/config";
import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn("⚠️ Warning: GROQ_API_KEY is missing. Add it to apps/api/.env or set the environment variable.");
}

export const groq = new Groq({
  apiKey: apiKey || "dummy-key-for-test-environments"
});

export const DEFAULT_CHAT_MODEL = process.env.AI_MODEL || "openai/gpt-oss-120b";
export const DEFAULT_TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL || "whisper-large-v3-turbo";
