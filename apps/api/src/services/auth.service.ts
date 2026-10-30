import crypto from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

// Secret key for HMAC token signing (only used in dev / testing, disabled in production)
const IS_PROD = process.env.NODE_ENV === "production";
const ENFORCE_AUTH = process.env.AUTH_ENFORCE === "true" || IS_PROD;
const AUTH_SECRET = process.env.AUTH_SECRET || (IS_PROD ? "" : "voxflow_local_dev_secret_key_32chars_min!");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseClientInstance: SupabaseClient | null = null;
let customTestingClient: SupabaseClient | null | undefined = undefined;

/**
 * Allow injection or mocking of Supabase client in test environments
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null) {
  customTestingClient = client;
}

/**
 * Get or lazily initialize the Supabase client using production/dev environment variables
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (customTestingClient !== undefined) {
    return customTestingClient;
  }
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (url && key && url.startsWith("https://") && !url.includes("placeholder")) {
    supabaseClientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseClientInstance;
}

/**
 * Verify a Supabase JWT access token using the official Supabase Auth API
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user || !user.id) {
      if (error) {
        // Safe warning log without exposing the access token
        console.warn(`[auth] Supabase token verification failed: ${error.message} (status: ${error.status || 401})`);
      }
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role
    };
  } catch (err: any) {
    console.warn(`[auth] Unexpected error during token verification: ${err?.message || "Unknown error"}`);
    return null;
  }
}

/**
 * Generate a cryptographically signed auth token for a given user ID (HMAC fallback for dev / testing).
 * Format: `<userId>.<timestamp>.<hmacSignature>`
 */
export function generateAuthToken(userId: string, secret = AUTH_SECRET): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}.${timestamp}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Verify a signed HMAC auth token and extract the verified user ID.
 * Returns null if token is malformed, expired (>30 days), or has an invalid signature.
 */
export function verifyAuthToken(token: string, secret = AUTH_SECRET): AuthenticatedUser | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;

  const [userId, timestampStr, providedSignature] = parts;
  if (!userId || !timestampStr || !providedSignature) return null;

  // Sanitize user ID format (UUID or alphanumeric, underscores, hyphens, 1-64 chars)
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
    return null;
  }

  const payload = `${userId}.${timestampStr}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const providedBuf = Buffer.from(providedSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  // Token expiration: 30 days
  const tokenTime = parseInt(timestampStr, 10);
  if (isNaN(tokenTime) || Date.now() - tokenTime > 30 * 24 * 60 * 60 * 1000) {
    return null;
  }

  return { id: userId };
}

/**
 * Authenticate an incoming Fastify request.
 * - Extracts token from `Authorization: Bearer <token>` or `x-voxflow-auth-token`.
 * - Validates Supabase JWTs via Supabase Auth when configured.
 * - Falls back to HMAC validation for local testing/dev.
 * - Rejects unauthenticated requests in production or when ENFORCE_AUTH=true with 401.
 * - Prevents client from spoofing another user via `x-user-id`.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.authorization;
  const customAuthHeader = request.headers["x-voxflow-auth-token"] as string | undefined;

  let token: string | null = null;

  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      token = match[1].trim().replace(/^"(.*)"$/, "$1");
    }
  } else if (customAuthHeader) {
    token = customAuthHeader.trim().replace(/^"(.*)"$/, "$1");
  }

  if (token) {
    let verified: AuthenticatedUser | null = null;

    // 1. If Supabase is configured, verify token with Supabase Auth
    if (getSupabaseClient()) {
      verified = await verifySupabaseToken(token);
    }

    // 2. If not verified by Supabase (or Supabase not active), check HMAC signature ONLY in non-production
    if (!verified && !IS_PROD && AUTH_SECRET) {
      verified = verifyAuthToken(token, AUTH_SECRET);
    }

    if (!verified) {
      await reply.code(401).send({
        error: "Invalid or expired authorization token.",
        code: "INVALID_AUTH_TOKEN"
      });
      return null;
    }

    // Security check: if client also passes an explicit x-user-id, it MUST match the token!
    const clientSuppliedUserId = request.headers["x-user-id"] as string | undefined;
    if (clientSuppliedUserId && clientSuppliedUserId !== verified.id) {
      await reply.code(403).send({
        error: "Forbidden: Client-supplied user ID does not match authenticated token.",
        code: "IMPERSONATION_FORBIDDEN"
      });
      return null;
    }

    return verified;
  }

  // If no token was supplied:
  if (ENFORCE_AUTH) {
    await reply.code(401).send({
      error: "Authentication required. Missing Bearer token in Authorization header.",
      code: "MISSING_AUTHENTICATION"
    });
    return null;
  }

  // Dev / Preview fallback: allow safe local testing identifier
  const rawDevUser = (request.headers["x-user-id"] as string) || "user_me";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(rawDevUser)) {
    await reply.code(400).send({
      error: "Invalid user ID format.",
      code: "INVALID_USER_ID"
    });
    return null;
  }

  return { id: rawDevUser };
}
