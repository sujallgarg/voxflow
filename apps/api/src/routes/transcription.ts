import type { FastifyPluginAsync } from "fastify";
import { transcribeAudio } from "../services/transcription.service.js";

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

const transcriptionRoute: FastifyPluginAsync = async (app) => {
  app.post("/transcribe", async (request, reply) => {
    try {
      if (!request.isMultipart()) {
        return reply.code(400).send({
          error: "Request must be multipart/form-data with an audio file.",
          code: "NOT_MULTIPART"
        });
      }

      const file = await request.file();

      if (!file) {
        return reply.code(400).send({
          error: "Audio file is required.",
          code: "MISSING_AUDIO_FILE"
        });
      }

      if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
        return reply.code(400).send({
          error: `Unsupported audio format: ${file.mimetype}. Supported formats include WebM, WAV, MP3, and OGG.`,
          code: "UNSUPPORTED_AUDIO_FORMAT"
        });
      }

      const audioBuffer = await file.toBuffer();

      if (!audioBuffer || audioBuffer.length === 0) {
        return reply.code(400).send({
          error: "Audio file is empty.",
          code: "EMPTY_AUDIO_FILE"
        });
      }

      app.log.info({
        action: "transcribeAudio",
        filename: file.filename,
        mimetype: file.mimetype,
        sizeBytes: audioBuffer.length
      });

      const text = await transcribeAudio(
        audioBuffer,
        file.filename
      );

      return {
        text
      };
    } catch (error: any) {
      app.log.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown transcription error";

      return reply.code(500).send({
        error: message,
        code: "TRANSCRIPTION_ERROR"
      });
    }
  });
};

export default transcriptionRoute;