import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";
import { supabase } from "./supabase";

describe("Subscription Context & API Client Authentication Guard Tests", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Scenario 1: Unauthenticated visitor does not make protected subscription API call", async () => {
    // Mock Supabase to return no session
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: null
    } as any);

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    // Call getSubscription without user ID or with placeholder
    const resUnauth = await api.getSubscription();
    expect(resUnauth).toEqual({ entitlements: null, subscription: null });

    const resPlaceholder = await api.getSubscription("user_me");
    expect(resPlaceholder).toEqual({ entitlements: null, subscription: null });

    // Assert that fetch was NEVER called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Scenario 2: Authenticated user attaches valid Bearer token to subscription request", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "mock-valid-supabase-jwt-token-12345",
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      },
      error: null
    } as any);

    const mockResponse = {
      entitlements: {
        userId: "usr_test_uuid_1",
        planId: "free",
        status: "free",
        isPremium: false
      },
      subscription: null
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });
    globalThis.fetch = fetchMock;

    const res = await api.getSubscription("usr_test_uuid_1");
    expect(res.entitlements.userId).toBe("usr_test_uuid_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/billing/subscription");
    expect(options.headers.Authorization).toBe("Bearer mock-valid-supabase-jwt-token-12345");
    // Ensure placeholder x-user-id is NOT sent
    expect(options.headers["x-user-id"]).toBeUndefined();
  });

  it("Scenario 3: Expired token on 401 triggers single refresh and retries once", async () => {
    // Initial expired session
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "expired-token-1",
          expires_at: Math.floor(Date.now() / 1000) + 100
        }
      },
      error: null
    } as any);

    // Refresh returns fresh token
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: {
          access_token: "refreshed-valid-token-2",
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      },
      error: null
    } as any);

    const fetchMock = vi
      .fn()
      // First attempt returns 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid or expired authorization token." })
      })
      // Second retry attempt returns 200
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          entitlements: { userId: "usr_test_uuid_1", planId: "free" },
          subscription: null
        })
      });

    globalThis.fetch = fetchMock;

    const res = await api.getSubscription("usr_test_uuid_1");
    expect(res.entitlements.userId).toBe("usr_test_uuid_1");

    // Must be called exactly twice: initial + 1 retry
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCallHeaders = fetchMock.mock.calls[0][1].headers;
    const secondCallHeaders = fetchMock.mock.calls[1][1].headers;

    expect(firstCallHeaders.Authorization).toBe("Bearer expired-token-1");
    expect(secondCallHeaders.Authorization).toBe("Bearer refreshed-valid-token-2");
  });

  it("Scenario 4: Failed 401 retry prevents infinite retry loops and throws error", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "token-fail-1",
          expires_at: Math.floor(Date.now() / 1000) + 100
        }
      },
      error: null
    } as any);

    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: {
          access_token: "token-fail-2",
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      },
      error: null
    } as any);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid token 1" })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid token 2" })
      });

    globalThis.fetch = fetchMock;

    await expect(api.getSubscription("usr_test_uuid_1")).rejects.toThrow("Invalid token 2");
    // Strictly max 2 calls (initial + single retry), never loop
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
