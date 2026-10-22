import type { FastifyPluginAsync } from "fastify";
import { transformTranscript } from "../services/transformation.service.js";
import { authenticateRequest } from "../services/auth.service.js";
import { entitlementService } from "../services/entitlement.service.js";

const transformationRoute: FastifyPluginAsync = async (app) => {
  app.post("/transform", async (request, reply) => {
    try {
      const body = request.body as {
        transcript?: string;
        meaning?: string;
        intent?: string;
        audience?: string;
        communicationType?: string;
        tone?: string;
        formality?: string;
        likelyChannel?: string;
        purpose?: string;
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

      const preCheck = await entitlementService.checkQuota(user.id, "text_correction", 1);
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

      const result = await transformTranscript({
        transcript: body.transcript,
        meaning: body.meaning,
        intent: body.intent,
        audience: body.audience,
        communicationType: body.communicationType,
        tone: body.tone,
        formality: body.formality,
        likelyChannel: body.likelyChannel,
        purpose: body.purpose,
        targetLanguage: body.targetLanguage
      });

      // Commit text_correction quota upon successful outcome
      await entitlementService.consumeQuota(user.id, "text_correction", 1);
      const entitlements = await entitlementService.getUserEntitlements(user.id);

      return {
        ...result,
        usage: entitlements.usage,
        entitlements
      };
    } catch (error) {
      app.log.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown transformation error";

      return reply.code(500).send({
        error: message
      });
    }
  });
};

export default transformationRoute;