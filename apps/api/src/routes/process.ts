import type { FastifyPluginAsync } from "fastify";
import { processVoicePipeline } from "../services/process.service";

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

      app.log.info({
        action: "processVoicePipeline",
        transcriptLength: body.transcript.length,
        targetLanguage: body.targetLanguage
      });

      const result = await processVoicePipeline({
        transcript: body.transcript,
        targetLanguage: body.targetLanguage
      });

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
