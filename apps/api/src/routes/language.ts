import type { FastifyPluginAsync } from "fastify";
import { detectLanguage } from "../services/language.service";

const languageRoute: FastifyPluginAsync = async (app) => {
  app.post("/detect-language", async (request, reply) => {
    try {
      const body = request.body as {
        transcript?: string;
      };

      if (!body?.transcript?.trim()) {
        return reply.code(400).send({
          error: "Transcript is required."
        });
      }

      app.log.info({
        transcript: body.transcript
      });

      const result = await detectLanguage(
        body.transcript
      );

      return result;
    } catch (error) {
      app.log.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown language detection error";

      return reply.code(500).send({
        error: message
      });
    }
  });
};

export default languageRoute;