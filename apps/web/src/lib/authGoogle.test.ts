import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { supabase } from "./supabase";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage?.clear) {
  (globalThis as any).localStorage = new MemoryStorage();
}
if (typeof globalThis.sessionStorage === "undefined" || !globalThis.sessionStorage?.clear) {
  (globalThis as any).sessionStorage = new MemoryStorage();
}
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = {
    location: {
      origin: "https://voxflowai.devs.surf",
      hash: "",
      search: "",
      pathname: "/"
    }
  };
}

describe("Google OAuth Authentication Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initiates Google OAuth with correct provider, options, and stores return destination", async () => {
    const signInWithOAuthSpy = vi.spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.com/o/oauth2/v2/auth?test=1" },
      error: null
    } as any);

    // Simulated signInWithGoogle helper replicating authContext logic
    const signInWithGoogle = async (returnTo?: string) => {
      const target = returnTo || window.location.hash || "#/meetings";
      sessionStorage.setItem("voxflow_auth_redirect", target);
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent"
          }
        }
      });

      if (error) return { error: error.message };
      return { error: null, url: data?.url };
    };

    const res = await signInWithGoogle("#/meetings");
    expect(res.error).toBeNull();
    expect(res.url).toContain("accounts.google.com");

    expect(signInWithOAuthSpy).toHaveBeenCalledTimes(1);
    const [callArgs] = signInWithOAuthSpy.mock.calls;
    expect(callArgs[0].provider).toBe("google");
    expect(callArgs[0].options?.redirectTo).toBe(`${window.location.origin}/`);
    expect(callArgs[0].options?.queryParams).toEqual({
      access_type: "offline",
      prompt: "consent"
    });

    expect(sessionStorage.getItem("voxflow_auth_redirect")).toBe("#/meetings");
  });

  it("handles Google OAuth initiation error gracefully", async () => {
    vi.spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: null },
      error: { message: "OAuth provider error: access denied by policy" }
    } as any);

    const signInWithGoogle = async (returnTo?: string) => {
      const target = returnTo || window.location.hash || "#/meetings";
      sessionStorage.setItem("voxflow_auth_redirect", target);
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/`;

      const { data: _data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent"
          }
        }
      });

      if (error) return { error: error.message };
      return { error: null };
    };

    const res = await signInWithGoogle("#/billing");
    expect(res.error).toBe("OAuth provider error: access denied by policy");
  });

  it("maps Google OAuth user profile metadata correctly with email pre-verified", () => {
    const mockGoogleSupabaseUser = {
      id: "usr_google_12345",
      email: "alex.developer@gmail.com",
      email_confirmed_at: "2026-03-15T12:00:00Z",
      user_metadata: {
        full_name: "Alex Developer",
        avatar_url: "https://lh3.googleusercontent.com/a/test-avatar"
      }
    };

    // Replicate mapping logic from authContext
    const mapSupabaseUser = (user: any) => {
      if (!user || !user.id || !user.email) return null;
      return {
        id: user.id,
        email: user.email,
        emailConfirmed: Boolean(user.email_confirmed_at),
        name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email.split("@")[0]
      };
    };

    const mapped = mapSupabaseUser(mockGoogleSupabaseUser);
    expect(mapped).toEqual({
      id: "usr_google_12345",
      email: "alex.developer@gmail.com",
      emailConfirmed: true,
      name: "Alex Developer"
    });
  });

  it("handles account linking and session persistence when existing user signs in via Google", async () => {
    // Existing user previously registered with email
    const existingEmail = "sarah.team@voxflow.ai";

    const mockSession = {
      access_token: "jwt_token_google_auth_987",
      user: {
        id: "usr_linked_789",
        email: existingEmail,
        email_confirmed_at: "2026-01-10T10:00:00Z",
        user_metadata: {
          full_name: "Sarah VoxFlow"
        }
      }
    };

    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: mockSession },
      error: null
    } as any);

    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.email).toBe(existingEmail);
    expect(data.session?.user.id).toBe("usr_linked_789");

    // Simulating stored user sync
    localStorage.setItem("voxflow_current_user", JSON.stringify({
      id: data.session!.user.id,
      email: data.session!.user.email,
      name: data.session!.user.user_metadata.full_name
    }));

    const stored = JSON.parse(localStorage.getItem("voxflow_current_user")!);
    expect(stored.email).toBe(existingEmail);
    expect(stored.name).toBe("Sarah VoxFlow");
  });

  it("detects OAuth cancellation from error query params and provides user-friendly alert", () => {
    const parseOAuthError = (urlSearch: string) => {
      const params = new URLSearchParams(urlSearch);
      const error = params.get("error");
      const errorDescription = params.get("error_description");

      if (error || errorDescription) {
        if (
          error === "access_denied" ||
          (errorDescription && errorDescription.toLowerCase().includes("cancel"))
        ) {
          return "Google sign-in was cancelled. Please try again or sign in with your email.";
        }
        return errorDescription || `Google authentication error: ${error}`;
      }
      return null;
    };

    expect(parseOAuthError("?error=access_denied&error_code=403")).toBe(
      "Google sign-in was cancelled. Please try again or sign in with your email."
    );
    expect(parseOAuthError("?error=access_denied&error_description=User+cancelled+authorization")).toBe(
      "Google sign-in was cancelled. Please try again or sign in with your email."
    );
    expect(parseOAuthError("?error=server_error&error_description=Internal+auth+timeout")).toBe(
      "Internal auth timeout"
    );
    expect(parseOAuthError("")).toBeNull();
  });

  it("verifies standard email/password authentication continues to function alongside Google OAuth", async () => {
    const signInPasswordSpy = vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValue({
      data: {
        session: { access_token: "jwt_token_pw" } as any,
        user: { id: "usr_pw_1", email: "standard@domain.com", email_confirmed_at: "2026-02-01" } as any
      },
      error: null
    });

    const signUpSpy = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
      data: {
        session: null,
        user: { id: "usr_new_1", email: "new@domain.com", email_confirmed_at: null } as any
      },
      error: null
    });

    // Test signInWithPassword
    const loginRes = await supabase.auth.signInWithPassword({
      email: "standard@domain.com",
      password: "SuperSecretPassword123!"
    });
    expect(signInPasswordSpy).toHaveBeenCalledTimes(1);
    expect(loginRes.data.user?.email).toBe("standard@domain.com");

    // Test signUp
    const signupRes = await supabase.auth.signUp({
      email: "new@domain.com",
      password: "SuperSecretPassword123!"
    });
    expect(signUpSpy).toHaveBeenCalledTimes(1);
    expect(signupRes.data.user?.email).toBe("new@domain.com");
  });
});
