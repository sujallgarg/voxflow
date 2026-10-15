import type { FastifyPluginAsync } from "fastify";
import { meetingStore, type MeetingRecord } from "../services/meeting-store.service.js";
import { transcribeAudio } from "../services/transcription.service.js";
import { generateMeetingNotes } from "../services/meeting-notes.service.js";
import { authenticateRequest } from "../services/auth.service.js";

const meetingsRoute: FastifyPluginAsync = async (app) => {
  // 1. GET /meetings — List all meetings for the user
  app.get("/meetings", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const meetings = meetingStore.getMeetings(userId);
    return { meetings };
  });

  // 2. GET /meetings/:id — Get single meeting
  app.get("/meetings/:id", async (request, reply) => {
    const user = await authenticateRequest(request, reply);
    if (!user) return;
    const userId = user.id;
    const { id } = request.params as { id: string };
    const meeting = meetingStore.getMeetingById(userId, id);

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
    const meeting = meetingStore.saveMeeting(userId, {
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
    const existing = meetingStore.getMeetingById(userId, id);

    if (!existing) {
      return reply.code(404).send({
        error: "Meeting not found.",
        code: "MEETING_NOT_FOUND"
      });
    }

    const updates = request.body as Partial<MeetingRecord>;
    const updated = meetingStore.saveMeeting(userId, {
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
    const deleted = meetingStore.deleteMeeting(userId, id);

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

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          audioBuffer = await part.toBuffer();
          filename = part.filename || "meeting.webm";
        } else {
          const val = String(part.value || "");
          if (part.fieldname === "title") meetingTitle = val;
          if (part.fieldname === "targetLanguage" || part.fieldname === "language") targetLanguage = val;
        }
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        return reply.code(400).send({
          error: "Audio file is required and cannot be empty.",
          code: "EMPTY_AUDIO_FILE"
        });
      }

      app.log.info({
        action: "processMeetingRecording",
        userId,
        sizeBytes: audioBuffer.length,
        title: meetingTitle,
        targetLanguage
      });

      // 1. Transcribe audio via Whisper
      const transcript = await transcribeAudio(audioBuffer, filename);

      if (!transcript || !transcript.trim()) {
        return reply.code(400).send({
          error: "No spoken audio was detected in the recording.",
          code: "NO_SPEECH_DETECTED"
        });
      }

      // 2. Extract structured notes via Groq LLM
      const notesResult = await generateMeetingNotes(
        transcript,
        meetingTitle || undefined
      );

      // 3. Assemble and persist the MeetingRecord
      const meetingId = `meeting_${Date.now()}`;
      const now = new Date();

      const newMeeting: MeetingRecord = {
        id: meetingId,
        userId,
        title: notesResult.title || meetingTitle || "Recorded Meeting",
        date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        duration: "Completed",
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

      const savedMeeting = meetingStore.saveMeeting(userId, newMeeting);

      return reply.code(201).send({
        success: true,
        meetingId: savedMeeting.id,
        meeting: savedMeeting
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
