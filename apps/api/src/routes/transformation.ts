import type { FastifyPluginAsync } from "fastify";
import {
  transformTranscript
} from "../services/transformation.service";

const transformationRoute: FastifyPluginAsync =
  async (app) => {
    app.post(
      "/transform",
      async (request, reply) => {
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
              error: "Transcript is required."
            });
          }

          const result =
            await transformTranscript({
              transcript: body.transcript,
              meaning: body.meaning,
              intent: body.intent,
              audience: body.audience,
              communicationType:
                body.communicationType,
              tone: body.tone,
              formality: body.formality,
              likelyChannel:
                body.likelyChannel,
              purpose: body.purpose,
              targetLanguage:
                body.targetLanguage
            });

          return result;
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
      }
    );
  };

export default transformationRoute;