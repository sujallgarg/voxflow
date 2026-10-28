import type { FastifyPluginAsync } from "fastify";
import { detectContext } from "../services/context.service.js";
import { authenticateRequest } from "../services/auth.service.js";
import { entitlementService } from "../services/entitlement.service.js";

const contextRoute: FastifyPluginAsync = async (app) => {
  app.post("/detect-context", async (request, reply) => {
    try {
      const user = await authenticateRequest(request, reply);
      if (!user) return;

      const body = request.body as {
        transcript?: string;
      };

      if (!body?.transcript || typeof body.transcript !== "string" || !body.transcript.trim()) {
        return reply.code(400).send({
          error: "Transcript is required.",
          code: "MISSING_TRANSCRIPT"
        });
      }

      if (body.transcript.length > 50000) {
        return reply.code(400).send({
          error: "Transcript exceeds maximum length limit of 50,000 characters.",
          code: "PAYLOAD_TOO_LARGE"
        });
      }

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

      const result = await detectContext(body.transcript);
      return result;
    } catch (error) {
      app.log.error(error);
      const message = error instanceof Error ? error.message : "Unknown context detection error";
      return reply.code(500).send({
        error: message,
        code: "CONTEXT_DETECTION_ERROR"
      });
    }
  });
};

export default contextRoute;