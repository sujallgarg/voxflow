import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  name?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null; requiresVerification: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user || !user.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    emailConfirmed: Boolean(user.email_confirmed_at),
    name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email.split("@")[0]
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isConfigured = useMemo(() => isSupabaseConfigured(), []);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.warn("Auth initialization error:", error.message);
      }
      setSession(initialSession);
      setUser(mapSupabaseUser(initialSession?.user ?? null));
      setLoading(false);
    }).catch((err) => {
      console.warn("Failed to get initial session:", err);
      setLoading(false);
    });

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(mapSupabaseUser(currentSession?.user ?? null));
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        // Direct user to set a new password
        window.location.hash = "#/reset-password";
      } else if (event === "SIGNED_IN") {
        // If user was on login or verify, navigate to dashboard
        if (window.location.hash === "#/login" || window.location.hash === "#/verify") {
          window.location.hash = "#/meetings";
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isConfigured) {
      return { error: "Authentication service is not configured. Please supply Supabase environment variables." };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          return { error: "Please verify your email address before logging in. Check your inbox for the confirmation link." };
        }
        if (error.message.includes("Invalid login credentials")) {
          return { error: "Invalid email or password. Please verify and try again." };
        }
        return { error: error.message };
      }

      // Check if email confirmation is required and user has not confirmed
      if (data.user && !data.user.email_confirmed_at) {
        // Sign out right away if provider created a session without confirmation
        await supabase.auth.signOut();
        return { error: "Please verify your email address before accessing your account." };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "An unexpected error occurred during login." };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: string | null; requiresVerification: boolean }> => {
    if (!isConfigured) {
      return {
        error: "Authentication service is not configured. Please supply Supabase environment variables.",
        requiresVerification: false
      };
    }

    try {
      // Determine site URL for email confirmation redirect
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/#/verify`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name?.trim() || ""
          },
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        return { error: error.message, requiresVerification: false };
      }

      // If user is returned and session is null (or user has no confirmation timestamp), email verification is required
      const requiresVerification = !data.session || !data.user?.email_confirmed_at;

      return { error: null, requiresVerification };
    } catch (err: any) {
      return { error: err.message || "An unexpected error occurred during signup.", requiresVerification: false };
    }
  };

  const signOut = async (): Promise<void> => {
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Sign out error:", err);
      }
    }
    setSession(null);
    setUser(null);
    window.location.hash = "#/";
  };

  const requestPasswordReset = async (email: string): Promise<{ error: string | null }> => {
    if (!isConfigured) {
      return { error: "Authentication service is not configured. Please supply Supabase environment variables." };
    }

    try {
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/#/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirectUrl
      });

      if (error) {
        // Rate-limit or general error
        if (error.status === 429) {
          return { error: "Too many password reset requests. Please wait a few minutes before trying again." };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "An unexpected error occurred." };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    if (!isConfigured) {
      return { error: "Authentication service is not configured." };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to update password." };
    }
  };

  const resendVerification = async (email: string): Promise<{ error: string | null }> => {
    if (!isConfigured) {
      return { error: "Authentication service is not configured." };
    }

    try {
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/#/verify`;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to resend confirmation email." };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        resendVerification
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
