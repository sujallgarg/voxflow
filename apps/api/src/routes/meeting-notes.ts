import type { FastifyPluginAsync } from "fastify";
import { generateMeetingNotes } from "../services/meeting-notes.service.js";
import { authenticateRequest } from "../services/auth.service.js";
import { entitlementService } from "../services/entitlement.service.js";

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

      const user = await authenticateRequest(request, reply);
      if (!user) return;

      const preCheck = await entitlementService.checkQuota(user.id, "summary", 1);
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
        action: "generateMeetingNotes",
        userId: user.id,
        title: body.title,
        transcriptLength: body.transcript.length
      });

      const result = await generateMeetingNotes(
        body.transcript,
        body.title
      );

      // Commit summary usage only after successful outcome
      await entitlementService.consumeQuota(user.id, "summary", 1);

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
