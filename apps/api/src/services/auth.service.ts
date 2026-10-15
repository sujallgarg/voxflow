import crypto from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

// Secret key for HMAC token signing (falls back to local dev secret if not set in environment)
const AUTH_SECRET = process.env.AUTH_SECRET || "voxflow_local_dev_secret_key_32chars_min!";
const IS_PROD = process.env.NODE_ENV === "production";
const ENFORCE_AUTH = process.env.AUTH_ENFORCE === "true" || IS_PROD;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabase: SupabaseClient | null = null;

if (
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("placeholder")
) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Allow injection or mocking of Supabase client in test environments
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null) {
  supabase = client;
}

/**
 * Verify a Supabase JWT access token using the official Supabase Auth API
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser | null> {
  if (!supabase) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || !user.id) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role
    };
  } catch {
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

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (customAuthHeader) {
    token = customAuthHeader.trim();
  }

  if (token) {
    let verified: AuthenticatedUser | null = null;

    // 1. If Supabase is configured, verify token with Supabase Auth
    if (supabase) {
      verified = await verifySupabaseToken(token);
    }

    // 2. If not verified by Supabase (or Supabase not active), check HMAC signature
    if (!verified) {
      verified = verifyAuthToken(token);
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
