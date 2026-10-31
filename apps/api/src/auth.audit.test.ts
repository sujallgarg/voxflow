import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "./server.js";
import { setSupabaseClientForTesting } from "./services/auth.service.js";
import type { FastifyInstance } from "fastify";

describe("Production Authentication & Token Verification Audit", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildServer();
    await app.ready();
  });

  afterEach(async () => {
    setSupabaseClientForTesting(undefined);
    await app.close();
  });

  it("1. GET /billing/subscription returns 200 with valid authenticated token", async () => {
    // Mock Supabase getUser returning a verified user
    const mockSupabaseClient: any = {
      auth: {
        getUser: async (token: string) => {
          if (token === "valid-supabase-jwt-token-12345") {
            return {
              data: {
                user: {
                  id: "usr_verified_test_123",
                  email: "audit_user@voxflow.ai",
                  role: "authenticated"
                }
              },
              error: null
            };
          }
          return {
            data: { user: null },
            error: { message: "Invalid token", status: 401 }
          };
        }
      }
    };
    setSupabaseClientForTesting(mockSupabaseClient);

    const res = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: {
        authorization: "Bearer valid-supabase-jwt-token-12345"
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entitlements).toBeDefined();
    expect(body.entitlements.userId).toBe("usr_verified_test_123");
  });

  it("2. POST /transcribe returns 200 or 400 (multipart validation) with valid authenticated token", async () => {
    const mockSupabaseClient: any = {
      auth: {
        getUser: async (token: string) => {
          if (token === "valid-supabase-jwt-token-12345") {
            return {
              data: {
                user: {
                  id: "usr_verified_test_123",
                  email: "audit_user@voxflow.ai",
                  role: "authenticated"
                }
              },
              error: null
            };
          }
          return { data: { user: null }, error: { message: "Invalid token" } };
        }
      }
    };
    setSupabaseClientForTesting(mockSupabaseClient);

    // Call without multipart body to test auth passed before handler validation
    const res = await app.inject({
      method: "POST",
      url: "/transcribe",
      headers: {
        authorization: "Bearer valid-supabase-jwt-token-12345"
      }
    });

    // 400 NOT_MULTIPART proves that authentication succeeded and request reached multipart parser
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("NOT_MULTIPART");
  });

  it("3. Reject invalid or tampered token with 401 INVALID_AUTH_TOKEN", async () => {
    const mockSupabaseClient: any = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "JWT expired or signature invalid", status: 401 }
        })
      }
    };
    setSupabaseClientForTesting(mockSupabaseClient);

    const resSub = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: {
        authorization: "Bearer expired-or-invalid-jwt-token"
      }
    });

    expect(resSub.statusCode).toBe(401);
    const bodySub = JSON.parse(resSub.body);
    expect(bodySub.code).toBe("INVALID_AUTH_TOKEN");
    expect(bodySub.error).toBe("Invalid or expired authorization token.");

    const resTrans = await app.inject({
      method: "POST",
      url: "/transcribe",
      headers: {
        authorization: "Bearer expired-or-invalid-jwt-token"
      }
    });

    expect(resTrans.statusCode).toBe(401);
    const bodyTrans = JSON.parse(resTrans.body);
    expect(bodyTrans.code).toBe("INVALID_AUTH_TOKEN");
  });

  it("4. Reject unauthenticated requests in production or when ENFORCE_AUTH=true", async () => {
    // Test with AUTH_ENFORCE active
    const oldEnforce = process.env.AUTH_ENFORCE;
    try {
      process.env.AUTH_ENFORCE = "true";

      const res = await app.inject({
        method: "GET",
        url: "/billing/subscription",
        headers: {} // No authorization header
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("MISSING_AUTHENTICATION");
    } finally {
      process.env.AUTH_ENFORCE = oldEnforce;
    }
  });

  it("5. Reject client-supplied x-user-id mismatch (impersonation forbidden)", async () => {
    const mockSupabaseClient: any = {
      auth: {
        getUser: async () => ({
          data: {
            user: { id: "real_user_uuid_1", email: "real@voxflow.ai" }
          },
          error: null
        })
      }
    };
    setSupabaseClientForTesting(mockSupabaseClient);

    const res = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: {
        authorization: "Bearer real_user_token",
        "x-user-id": "victim_user_uuid_2"
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("IMPERSONATION_FORBIDDEN");
  });
});
