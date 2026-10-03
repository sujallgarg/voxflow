import type { FastifyPluginAsync } from "fastify";
import { understandTranscript } from "../services/understanding.service";

const understandingRoute: FastifyPluginAsync =
  async (app) => {
    app.post(
      "/understand",
      async (request, reply) => {
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

          const result =
            await understandTranscript(
              body.transcript
            );

          return result;
        } catch (error) {
          app.log.error(error);

          const message =
            error instanceof Error
              ? error.message
              : "Unknown understanding error";

          return reply.code(500).send({
            error: message
          });
        }
      }
    );
  };

export default understandingRoute;