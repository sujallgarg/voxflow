import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import transcriptionRoute from "./routes/transcription.js";
import languageRoute from "./routes/language.js";
import understandingRoute from "./routes/understanding.js";
import contextRoute from "./routes/context.js";
import transformationRoute from "./routes/transformation.js";
import processRoute from "./routes/process.js";
import meetingNotesRoute from "./routes/meeting-notes.js";
import meetingsRoute from "./routes/meetings.js";
import waitlistRoute from "./routes/waitlist.js";
import billingRoute from "./routes/billing.js";
import demoRoute from "./routes/demo.js";
import { createRateLimiter } from "./middleware/rate-limiter.js";

export function buildServer() {
  const isProd = process.env.NODE_ENV === "production";
  const app = Fastify({
    logger: true,
    trustProxy: isProd || process.env.RENDER === "true" || process.env.TRUST_PROXY === "true"
  });

  // Preserve rawBody for secure webhook signature validation
  app.addContentTypeParser(
    ["application/json", "text/plain"],
    { parseAs: "string" },
    (req, body, done) => {
      (req as any).rawBody = body;
      if (typeof body === "string" && body.trim().length > 0) {
        try {
          const json = JSON.parse(body);
          done(null, json);
          return;
        } catch {
          // Fall through if not valid JSON
        }
      }
      done(null, body);
    }
  );

  // CORS Configuration
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

      // Browser extension origin check
      if (origin.startsWith("chrome-extension://")) {
        // In development/test, allow unpacked extension origins
        if (!isProd) {
          cb(null, true);
          return;
        }

        // In production, require extension ID to match configured VoxFlow extension IDs
        const allowedExtIds = [
          process.env.CHROME_EXTENSION_ID,
          ...(process.env.ALLOWED_EXTENSION_IDS ? process.env.ALLOWED_EXTENSION_IDS.split(",") : [])
        ]
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id));

        const extId = origin.replace("chrome-extension://", "").split("/")[0];
        if (allowedExtIds.length > 0 && allowedExtIds.includes(extId)) {
          cb(null, true);
          return;
        }

        // Reject untrusted extension origins in production
        cb(null, false);
        return;
      }

      // Default fallback
      cb(null, false);
    },
    credentials: true
  });

  // Rate Limiter PreHandler Hook (120 req/min sliding window)
  app.addHook("preHandler", createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120 }));

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
  app.register(waitlistRoute);
  app.register(billingRoute);
  app.register(demoRoute);

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