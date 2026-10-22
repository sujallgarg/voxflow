import type { FastifyPluginAsync } from "fastify";
import { transcribeAudio } from "../services/transcription.service.js";
import { authenticateRequest } from "../services/auth.service.js";
import { entitlementService } from "../services/entitlement.service.js";
import {
  transcriptionStore,
  type VoiceTranscriptionRecord
} from "../services/transcription-store.service.js";

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
  // 1. POST /transcribe — Run audio through Whisper
  app.post("/transcribe", async (request, reply) => {
    try {
      const user = await authenticateRequest(request, reply);
      if (!user) return;

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

      const preCheck = await entitlementService.checkQuota(user.id, "voice_typing", 1);
      if (!preCheck.allowed) {
        return reply.code(403).send({
          error: preCheck.reason,
          code: preCheck.code,
          quotaType: preCheck.quotaType,
          limit: preCheck.limit,
          currentUsage: preCheck.currentUsage,
          remaining: preCheck.remaining,
          unit: preCheck.unit,
          resetDate: preCheck.resetDate,
          upgradeUrl: "#/pricing"
        });
      }

      app.log.info({
        action: "transcribeAudio",
        userId: user.id,
        filename: file.filename,
        mimetype: file.mimetype,
        sizeBytes: audioBuffer.length
      });

      const text = await transcribeAudio(audioBuffer, file.filename);

      // Commit quota only after successful transcription outcome
      await entitlementService.consumeQuota(user.id, "voice_typing", 1);
      const entitlements = await entitlementService.getUserEntitlements(user.id);

      return {
        text,
        usage: entitlements.usage,
        entitlements
      };
    } catch (error: any) {
      app.log.error(error);

      const message =
        error instanceof Error ? error.message : "Unknown transcription error";

      return reply.code(500).send({
        error: message,
        code: "TRANSCRIPTION_ERROR"
      });
    }
  });

  // 2. GET /transcriptions — List saved voice history for authenticated user
  app.get("/transcriptions", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    const transcriptions = await transcriptionStore.getTranscriptions(user.id);
    return { transcriptions };
  });

  // 3. GET /transcriptions/:id — Get single voice input record by ID (with guest claim support)
  app.get("/transcriptions/:id", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    let record = await transcriptionStore.getTranscriptionById(user.id, id);

    // If not found under current user, check if created under guest "user_me"
    if (!record) {
      const raw = await transcriptionStore.getTranscriptionByIdRaw(id);
      if (raw && raw.userId === "user_me" && user.id !== "user_me") {
        // Associate/claim guest voice record to authenticated account
        record = await transcriptionStore.saveTranscription(user.id, {
          ...raw,
          userId: user.id
        });
      }
    }

    if (!record) {
      return reply.code(404).send({
        error: "Transcription not found or does not belong to your account.",
        code: "TRANSCRIPTION_NOT_FOUND"
      });
    }

    return { transcription: record };
  });

  // 4. POST /transcriptions — Persist or synchronize a voice input result
  app.post("/transcriptions", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    const body = request.body as Partial<VoiceTranscriptionRecord>;
    if (!body || (!body.transcript && !body.transformedText)) {
      return reply.code(400).send({
        error: "Transcript or transformed text is required.",
        code: "MISSING_TRANSCRIPT_CONTENT"
      });
    }

    const id = body.id || `vt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check conflict with other user
    const conflict = await transcriptionStore.getTranscriptionByIdRaw(id);
    if (conflict && conflict.userId !== user.id && conflict.userId !== "user_me") {
      return reply.code(409).send({
        error: "Transcription record conflict with existing identifier.",
        code: "TRANSCRIPTION_ID_CONFLICT"
      });
    }

    const title =
      body.title?.trim() ||
      (body.transcript || body.transformedText || "Voice Dictation").slice(0, 50);

    const record = await transcriptionStore.saveTranscription(user.id, {
      id,
      userId: user.id,
      title,
      transcript: body.transcript || "",
      transformedText: body.transformedText || body.transcript || "",
      language: body.language || "Auto",
      status: body.status || "completed",
      createdAt: body.createdAt || new Date().toISOString()
    });

    return reply.code(201).send({
      success: true,
      transcription: record
    });
  });

  // 5. DELETE /transcriptions/:id — Delete a saved voice input record
  app.delete("/transcriptions/:id", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };
    const deleted = await transcriptionStore.deleteTranscription(user.id, id);

    if (!deleted) {
      return reply.code(404).send({
        error: "Transcription record not found or already deleted.",
        code: "TRANSCRIPTION_NOT_FOUND"
      });
    }

    return { success: true, deletedId: id };
  });
};

export default transcriptionRoute;