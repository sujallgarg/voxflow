import type { FastifyPluginAsync } from "fastify";
import { transcribeAudio } from "../services/transcription.service";

const transcriptionRoute: FastifyPluginAsync = async (app) => {
  app.post("/transcribe", async (request, reply) => {
    try {
      const file = await request.file();

      if (!file) {
        return reply.code(400).send({
          error: "Audio file is required."
        });
      }

      const audioBuffer = await file.toBuffer();

      if (!audioBuffer.length) {
        return reply.code(400).send({
          error: "Audio file is empty."
        });
      }

      app.log.info({
        filename: file.filename,
        mimetype: file.mimetype,
        size: audioBuffer.length
      });

      const text = await transcribeAudio(
        audioBuffer,
        file.filename
      );

      return {
        text
      };
    } catch (error) {
      app.log.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unknown transcription error";

      return reply.code(500).send({
        error: message
      });
    }
  });
};

export default transcriptionRoute;