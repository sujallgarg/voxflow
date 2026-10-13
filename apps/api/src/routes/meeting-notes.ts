import type { FastifyPluginAsync } from "fastify";
import { generateMeetingNotes } from "../services/meeting-notes.service.js";

const meetingNotesRoute: FastifyPluginAsync = async (app) => {
  app.post("/meeting-notes", async (request, reply) => {
    try {
      const body = request.body as {
        transcript?: string;
        title?: string;
      };

      if (!body?.transcript?.trim()) {
        return reply.code(400).send({
          error: "Transcript is required to generate meeting notes.",
          code: "MISSING_TRANSCRIPT"
        });
      }

      app.log.info({
        action: "generateMeetingNotes",
        title: body.title,
        transcriptLength: body.transcript.length
      });

      const result = await generateMeetingNotes(
        body.transcript,
        body.title
      );

      return result;
    } catch (error: any) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : "Meeting notes generation failed";
      return reply.code(500).send({
        error: message,
        code: "MEETING_NOTES_ERROR"
      });
    }
  });
};

export default meetingNotesRoute;
