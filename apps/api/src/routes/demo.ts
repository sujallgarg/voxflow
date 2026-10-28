import type { FastifyPluginAsync } from "fastify";
import { transcribeAudio } from "../services/transcription.service.js";
import { processVoicePipeline } from "../services/process.service.js";

const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "video/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "application/octet-stream"
]);

// Guest Demo IP Rate Limiter (Max 5 requests per 15 minutes per IP)
const DEMO_WINDOW_MS = 15 * 60 * 1000;
const DEMO_MAX_REQUESTS = 5;
const MAX_DEMO_AUDIO_BYTES = 2.5 * 1024 * 1024; // 2.5MB max audio clip for guest demo

const demoRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function resetDemoRateLimitsForTesting() {
  demoRateLimitMap.clear();
}

function checkDemoRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = demoRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    demoRateLimitMap.set(ip, { count: 1, resetAt: now + DEMO_WINDOW_MS });
    return { allowed: true, remaining: DEMO_MAX_REQUESTS - 1 };
  }

  if (entry.count >= DEMO_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: DEMO_MAX_REQUESTS - entry.count };
}

// Periodic cleanup of stale IP entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of demoRateLimitMap.entries()) {
    if (now > entry.resetAt) {
      demoRateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

const demoRoute: FastifyPluginAsync = async (app) => {
  app.post("/demo/process-audio", async (request, reply) => {
    try {
      // 1. Strict IP-based rate limiting for guest visitors
      const clientIp = request.ip || "127.0.0.1";
      const rateLimit = checkDemoRateLimit(clientIp);

      if (!rateLimit.allowed) {
        return reply.code(429).send({
          error: "Guest demo limit reached (5 requests per 15 minutes). Create a free account to get 100 free voice typings and 30 minutes of transcription every month!",
          code: "DEMO_RATE_LIMIT_EXCEEDED",
          remainingDemoRequests: 0,
          upgradeUrl: "#/signup"
        });
      }

      // 2. Validate multipart request
      if (!request.isMultipart()) {
        return reply.code(400).send({
          error: "Request must be multipart/form-data containing the audio recording.",
          code: "NOT_MULTIPART"
        });
      }

      let audioBuffer: Buffer | null = null;
      let filename = "demo-recording.webm";
      let targetLanguage = "Auto";

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          audioBuffer = await part.toBuffer();
          filename = part.filename || "demo.webm";

          if (part.mimetype && !ALLOWED_MIME_TYPES.has(part.mimetype.toLowerCase())) {
            return reply.code(400).send({
              error: `Unsupported audio format: ${part.mimetype}. Supported formats: WebM, WAV, MP3, OGG.`,
              code: "UNSUPPORTED_AUDIO_FORMAT"
            });
          }
        } else {
          const val = String(part.value || "");
          if (part.fieldname === "targetLanguage" || part.fieldname === "language") {
            targetLanguage = val.trim();
          }
        }
      }

      // 3. Audio payload size validation
      if (!audioBuffer || audioBuffer.length === 0) {
        return reply.code(400).send({
          error: "Audio file is required and cannot be empty.",
          code: "EMPTY_AUDIO_FILE"
        });
      }

      if (audioBuffer.length > MAX_DEMO_AUDIO_BYTES) {
        return reply.code(400).send({
          error: "Demo recording exceeds maximum permitted size of 2.5MB (approx 30 seconds). Create a free account for longer recordings.",
          code: "PAYLOAD_TOO_LARGE"
        });
      }

      app.log.info({
        action: "demoProcessAudio",
        ip: clientIp,
        sizeBytes: audioBuffer.length,
        targetLanguage
      });

      // 4. Run audio through Whisper
      const text = await transcribeAudio(audioBuffer, filename);

      if (!text || !text.trim()) {
        return reply.code(400).send({
          error: "No spoken audio was detected in the recording. Please speak louder or closer to the microphone.",
          code: "NO_SPEECH_DETECTED"
        });
      }

      // 5. Run contextual transformation pipeline
      const pipelineResult = await processVoicePipeline({
        transcript: text,
        targetLanguage: targetLanguage !== "Auto" ? targetLanguage : undefined
      });

      // 6. Return guest result with no persistent database side-effects
      return reply.code(200).send({
        success: true,
        isGuestDemo: true,
        text,
        pipeline: pipelineResult,
        remainingDemoRequests: rateLimit.remaining
      });
    } catch (error: any) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : "Guest demo processing failed.";
      return reply.code(500).send({
        error: message,
        code: "DEMO_PROCESSING_ERROR"
      });
    }
  });
};

export default demoRoute;
