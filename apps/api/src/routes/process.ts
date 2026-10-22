import type { FastifyPluginAsync } from "fastify";
import { processVoicePipeline } from "../services/process.service.js";
import { authenticateRequest } from "../services/auth.service.js";
import { entitlementService } from "../services/entitlement.service.js";

const processRoute: FastifyPluginAsync = async (app) => {
  app.post("/process", async (request, reply) => {
    try {
      const body = request.body as {
        transcript?: string;
        targetLanguage?: string;
      };

      if (!body?.transcript?.trim()) {
        return reply.code(400).send({
          error: "Transcript is required.",
          code: "MISSING_TRANSCRIPT"
        });
      }

      const user = await authenticateRequest(request, reply);
      if (!user) return;

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
        action: "processVoicePipeline",
        userId: user.id,
        transcriptLength: body.transcript.length,
        targetLanguage: body.targetLanguage
      });

      const result = await processVoicePipeline({
        transcript: body.transcript,
        targetLanguage: body.targetLanguage
      });

      // Commit usage only after successful pipeline outcome
      await entitlementService.consumeQuota(user.id, "voice_typing", 1);
      await entitlementService.consumeQuota(user.id, "text_correction", 1);

      return result;
    } catch (error: any) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : "Pipeline processing error";
      return reply.code(500).send({
        error: message,
        code: "PIPELINE_ERROR"
      });
    }
  });
};

export default processRoute;
