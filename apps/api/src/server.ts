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

  function isAllowedCorsOrigin(origin: string | undefined): boolean {
    // When no origin header is present (e.g. server-to-server / curl / native apps), allow
    if (!origin) {
      return true;
    }

    // 1. Explicitly configured origins from env
    if (corsOriginEnv) {
      const allowedOrigins = corsOriginEnv.split(",").map((o) => o.trim());
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return true;
      }
    }

    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname.toLowerCase();

      // 2. Official production and preview Vercel domains
      if (
        origin === "https://voxflow-one.vercel.app" ||
        hostname === "voxflow-one.vercel.app" ||
        (/^voxflow(-[a-z0-9_-]+)?\.vercel\.app$/i.test(hostname)) ||
        (parsed.protocol === "https:" && hostname.endsWith(".vercel.app") && hostname.includes("voxflow"))
      ) {
        return true;
      }

      // 3. Official custom production domains
      if (
        origin === "https://voxflow.com" ||
        origin === "https://www.voxflow.com" ||
        origin === "https://app.voxflow.com" ||
        origin === "https://voxflow-web.onrender.com" ||
        (parsed.protocol === "https:" && (hostname === "voxflow.com" || hostname.endsWith(".voxflow.com")))
      ) {
        return true;
      }

      // 4. Local development origins
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return true;
      }
    } catch {
      // Invalid URL
    }

    // 5. Browser extension origin check
    if (origin.startsWith("chrome-extension://")) {
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
        return true;
      }

      const allowedExtIds = [
        process.env.CHROME_EXTENSION_ID,
        ...(process.env.ALLOWED_EXTENSION_IDS ? process.env.ALLOWED_EXTENSION_IDS.split(",") : [])
      ]
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id));

      const extId = origin.replace("chrome-extension://", "").split("/")[0];
      if (allowedExtIds.length > 0 && allowedExtIds.includes(extId)) {
        return true;
      }
      return false;
    }

    // Default fallback
    return false;
  }

  app.register(cors, {
    origin: (origin, cb) => {
      const allowed = isAllowedCorsOrigin(origin);
      cb(null, allowed);
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "x-idempotency-key",
      "x-user-id",
      "x-request-id",
      "apikey",
      "x-client-info",
      "Range"
    ],
    exposedHeaders: [
      "Content-Range",
      "X-Content-Range",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset"
    ],
    credentials: true,
    preflight: true
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