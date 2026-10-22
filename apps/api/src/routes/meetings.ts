import type { FastifyPluginAsync } from "fastify";
import { meetingStore, type MeetingRecord } from "../services/meeting-store.service.js";
import { transcribeAudio, transcribeAudioDetailed } from "../services/transcription.service.js";
import { generateMeetingNotes } from "../services/meeting-notes.service.js";
import { authenticateRequest } from "../services/auth.service.js";
import { entitlementService } from "../services/entitlement.service.js";

const meetingsRoute: FastifyPluginAsync = async (app) => {
  // 1. GET /meetings — List all meetings for the user
  app.get("/meetings", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const meetings = await meetingStore.getMeetings(userId);
    return { meetings };
  });

  // 2. GET /meetings/:id — Get single meeting
  app.get("/meetings/:id", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const { id } = request.params as { id: string };
    let meeting = await meetingStore.getMeetingById(userId, id);

    // If not found for current user, check if this is an unassigned / extension-created meeting
    if (!meeting) {
      const rawMeeting = await meetingStore.getMeetingByIdRaw(id);
      if (rawMeeting && rawMeeting.userId === "user_me" && userId !== "user_me") {
        // Associate / claim guest meeting to authenticated user
        rawMeeting.userId = userId;
        rawMeeting.updatedAt = new Date().toISOString();
        meeting = await meetingStore.saveMeeting(userId, rawMeeting);
      }
    }

    if (!meeting) {
      return reply.code(404).send({
        error: "Meeting record not found or does not belong to this account.",
        code: "MEETING_NOT_FOUND"
      });
    }

    return { meeting };
  });

  // 3. POST /meetings — Create or replace meeting
  app.post("/meetings", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const body = request.body as Partial<MeetingRecord>;

    if (!body || !body.title) {
      return reply.code(400).send({
        error: "Meeting title is required.",
        code: "MISSING_TITLE"
      });
    }

    const meetingId = body.id || `meeting_${Date.now()}`;
    const conflict = await meetingStore.getMeetingByIdRaw(meetingId);
    if (conflict && conflict.userId !== userId) {
      return reply.code(409).send({
        error: "Meeting record conflict with existing identifier.",
        code: "MEETING_ID_CONFLICT"
      });
    }

    // If this is a new meeting (not an existing update), check and consume meeting quota
    if (!conflict) {
      const quotaCheck = await entitlementService.consumeQuota(userId, "meeting", 1);
      if (!quotaCheck.allowed) {
        return reply.code(403).send({
          error: quotaCheck.reason,
          code: quotaCheck.code,
          quotaType: quotaCheck.quotaType,
          limit: quotaCheck.limit,
          currentUsage: quotaCheck.currentUsage,
          remaining: quotaCheck.remaining,
          unit: quotaCheck.unit,
          resetDate: quotaCheck.resetDate,
          upgradeUrl: "#/pricing"
        });
      }

      if (body.fullSummary || body.summaryPreview) {
        await entitlementService.consumeQuota(userId, "summary", 1);
      }
    }

    const meeting = await meetingStore.saveMeeting(userId, {
      ...body,
      id: meetingId,
      title: body.title
    });

    return reply.code(201).send({ success: true, meeting });
  });

  // 4. PATCH /meetings/:id — Update meeting
  app.patch("/meetings/:id", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const { id } = request.params as { id: string };
    const existing = await meetingStore.getMeetingById(userId, id);

    if (!existing) {
      return reply.code(404).send({
        error: "Meeting not found.",
        code: "MEETING_NOT_FOUND"
      });
    }

    const updates = request.body as Partial<MeetingRecord>;
    const updated = await meetingStore.saveMeeting(userId, {
      ...existing,
      ...updates,
      id,
      title: updates.title || existing.title
    });

    return { success: true, meeting: updated };
  });

  // 5. DELETE /meetings/:id — Delete meeting
  app.delete("/meetings/:id", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const { id } = request.params as { id: string };
    const deleted = await meetingStore.deleteMeeting(userId, id);

    if (!deleted) {
      return reply.code(404).send({
        error: "Meeting not found or already deleted.",
        code: "MEETING_NOT_FOUND"
      });
    }

    return { success: true, deletedId: id };
  });

  // 6. POST /meetings/process-recording — Complete end-to-end meeting processing
  app.post("/meetings/process-recording", async (request, reply) => {
    try {
      const user = await authenticateRequest(request, reply);
      if (!user) return;
      const userId = user.id;

      if (!request.isMultipart()) {
        return reply.code(400).send({
          error: "Request must be multipart/form-data containing the recorded meeting audio.",
          code: "NOT_MULTIPART"
        });
      }

      let audioBuffer: Buffer | null = null;
      let filename = "meeting-recording.webm";
      let meetingTitle = "";
      let targetLanguage = "Auto";
      let clientMeetingId = "";
      let clientDurationSeconds = 0;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          audioBuffer = await part.toBuffer();
          filename = part.filename || "meeting.webm";
        } else {
          const val = String(part.value || "");
          if (part.fieldname === "title") meetingTitle = val;
          if (part.fieldname === "targetLanguage" || part.fieldname === "language") targetLanguage = val;
          if (part.fieldname === "meetingId" || part.fieldname === "id") clientMeetingId = val.trim();
          if (part.fieldname === "durationSeconds" || part.fieldname === "duration") {
            const parsed = parseFloat(val);
            if (!isNaN(parsed) && parsed > 0) clientDurationSeconds = Math.round(parsed);
          }
        }
      }

      const meetingId = clientMeetingId && /^[a-zA-Z0-9_-]{1,64}$/.test(clientMeetingId)
        ? clientMeetingId
        : `meeting_${Date.now()}`;

      // 1. Idempotency check: if meeting already exists and is completed for this user, return it without re-charging
      const existing = await meetingStore.getMeetingByIdRaw(meetingId);
      if (existing && (existing.userId === userId || existing.userId === "user_me") && existing.status === "completed") {
        return reply.code(200).send({
          success: true,
          meetingId: existing.id,
          meeting: existing
        });
      }

      // 2. Audio buffer validation before touching quota
      if (!audioBuffer || audioBuffer.length === 0) {
        return reply.code(400).send({
          error: "Audio file is required and cannot be empty.",
          code: "EMPTY_AUDIO_FILE"
        });
      }

      // 3. Pre-flight reservation / quota check
      const canRecord = await entitlementService.checkQuota(userId, "meeting", 1);
      if (!canRecord.allowed) {
        return reply.code(403).send({
          error: canRecord.reason,
          code: canRecord.code,
          quotaType: canRecord.quotaType,
          limit: canRecord.limit,
          currentUsage: canRecord.currentUsage,
          remaining: canRecord.remaining,
          unit: canRecord.unit,
          resetDate: canRecord.resetDate,
          upgradeUrl: "#/pricing"
        });
      }

      const estimatedSeconds = clientDurationSeconds > 0 ? clientDurationSeconds : Math.max(1, Math.round(audioBuffer.length / 3200));
      const canTranscribe = await entitlementService.checkQuota(userId, "transcription_seconds", estimatedSeconds);
      if (!canTranscribe.allowed) {
        return reply.code(403).send({
          error: canTranscribe.reason,
          code: canTranscribe.code,
          quotaType: canTranscribe.quotaType,
          limit: canTranscribe.limit,
          currentUsage: canTranscribe.currentUsage,
          remaining: canTranscribe.remaining,
          unit: canTranscribe.unit,
          resetDate: canTranscribe.resetDate,
          upgradeUrl: "#/pricing"
        });
      }

      app.log.info({
        action: "processMeetingRecording",
        userId,
        meetingId,
        sizeBytes: audioBuffer.length,
        title: meetingTitle,
        targetLanguage,
        clientDurationSeconds
      });

      // 4. Transcribe audio via Whisper (capturing exact duration)
      const transcribeResult = await transcribeAudioDetailed(audioBuffer, filename, {
        language: targetLanguage !== "Auto" ? targetLanguage : undefined,
        durationSeconds: clientDurationSeconds
      });

      const transcript = transcribeResult.text;
      const durationSeconds = transcribeResult.durationSeconds || clientDurationSeconds || 90;

      if (!transcript || !transcript.trim()) {
        return reply.code(400).send({
          error: "No spoken audio was detected in the recording.",
          code: "NO_SPEECH_DETECTED"
        });
      }

      // 5. Extract structured notes via Groq LLM
      const notesResult = await generateMeetingNotes(
        transcript,
        meetingTitle || undefined
      );

      // 6. Commit usage only after successful processing outcome
      const quotaCommit = await entitlementService.consumeMeetingRecordingQuota(userId, durationSeconds);
      if (!quotaCommit.allowed) {
        return reply.code(403).send({
          error: quotaCommit.reason,
          code: quotaCommit.code,
          quotaType: quotaCommit.quotaType,
          limit: quotaCommit.limit,
          currentUsage: quotaCommit.currentUsage,
          remaining: quotaCommit.remaining,
          unit: quotaCommit.unit,
          resetDate: quotaCommit.resetDate,
          upgradeUrl: "#/pricing"
        });
      }

      // 7. Assemble and persist the MeetingRecord
      const now = new Date();
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      const formattedDuration = mins > 0 ? (secs > 0 ? `${mins}m ${secs}s` : `${mins} mins`) : `${secs}s`;

      const newMeeting: MeetingRecord = {
        id: meetingId,
        userId,
        title: notesResult.title || meetingTitle || "Recorded Meeting",
        date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        duration: formattedDuration,
        durationSeconds,
        status: "completed",
        primaryLanguages: notesResult.primaryLanguages.length ? notesResult.primaryLanguages : ["English"],
        summaryPreview: notesResult.summary ? notesResult.summary.slice(0, 160) : "",
        fullSummary: notesResult.summary,
        participants: [
          {
            id: userId,
            name: "Organizer (You)",
            role: "Host",
            avatar: "ME",
            isCurrentUser: true
          }
        ],
        topics: notesResult.topics.map((t, idx) => ({
          id: `top_${Date.now()}_${idx}`,
          title: t.title,
          timeRange: "Session",
          summary: t.summary
        })),
        decisions: notesResult.decisions.map((d, idx) => ({
          id: `dec_${Date.now()}_${idx}`,
          decision: d.decision,
          context: d.context
        })),
        actionItems: notesResult.actionItems.map((a, idx) => ({
          id: `act_${Date.now()}_${idx}`,
          task: a.task,
          assignee: a.assignee || "Unassigned",
          dueDate: a.dueDate || "Follow-up",
          completed: a.completed || false
        })),
        transcript: [
          {
            id: `utt_${Date.now()}_0`,
            speakerId: "speaker_meeting",
            speakerName: "Meeting Audio",
            speakerRole: "Captured Audio",
            isCurrentUser: false,
            timestamp: "00:00",
            originalLanguage: notesResult.primaryLanguages[0] || "English",
            originalText: transcript
          }
        ],
        initialNotes: notesResult.keyPoints.length
          ? `Key Discussion Points:\n${notesResult.keyPoints.map((p) => `• ${p}`).join("\n")}`
          : ""
      };

      const savedMeeting = await meetingStore.saveMeeting(userId, newMeeting);
      const updatedEntitlements = await entitlementService.getUserEntitlements(userId);

      return reply.code(201).send({
        success: true,
        meetingId: savedMeeting.id,
        meeting: savedMeeting,
        entitlements: updatedEntitlements
      });
    } catch (error: any) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : "Meeting recording processing failed.";
      return reply.code(500).send({
        error: message,
        code: "PROCESS_RECORDING_ERROR"
      });
    }
  });
};

export default meetingsRoute;
