import type { FastifyPluginAsync } from "fastify";
import { detectContext } from "../services/context.service";

const contextRoute: FastifyPluginAsync =
  async (app) => {
    app.post(
      "/detect-context",
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

          const result = await detectContext(
            body.transcript
          );

          return result;
        } catch (error) {
          app.log.error(error);

          const message =
            error instanceof Error
              ? error.message
              : "Unknown context detection error";

          return reply.code(500).send({
            error: message
          });
        }
      }
    );
  };

export default contextRoute;