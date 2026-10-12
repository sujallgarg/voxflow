import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import transcriptionRoute from "./routes/transcription";
import languageRoute from "./routes/language";
import understandingRoute from "./routes/understanding";
import contextRoute from "./routes/context";
import transformationRoute from "./routes/transformation";
import processRoute from "./routes/process";
import meetingNotesRoute from "./routes/meeting-notes";
import meetingsRoute from "./routes/meetings";

export function buildServer() {
  const app = Fastify({
    logger: true
  });

  // CORS Configuration
  const isProd = process.env.NODE_ENV === "production";
  const corsOriginEnv = process.env.CORS_ORIGIN;

  app.register(cors, {
    origin: (origin, cb) => {
      // In development or when no origin header (e.g. mobile apps / curl), allow
      if (!isProd || !origin) {
        cb(null, true);
        return;
      }

      if (corsOriginEnv) {
        const allowedOrigins = corsOriginEnv.split(",").map((o) => o.trim());
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
      }

      // Default fallback
      cb(null, false);
    },
    credentials: true
  });

  // 50MB file size limit for audio / meeting recordings
  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024
    }
  });

  // Health endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "voxflow-api",
      timestamp: new Date().toISOString()
    };
  });

  // Register API routes (each route registered exactly once)
  app.register(transcriptionRoute);
  app.register(languageRoute);
  app.register(understandingRoute);
  app.register(contextRoute);
  app.register(transformationRoute);
  app.register(processRoute);
  app.register(meetingNotesRoute);
  app.register(meetingsRoute);

  return app;
}

// Start server if executed directly (not under test)
export const app = buildServer();
const port = Number(process.env.PORT ?? 3001);

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  try {
    await app.listen({
      port,
      host: "0.0.0.0"
    });

    console.log(`✓ VoxFlow API successfully running on port ${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}