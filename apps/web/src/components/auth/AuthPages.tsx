import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/authContext";
import { Logo } from "../Logo";

interface AuthPageProps {
  initialView: "login" | "signup" | "forgot-password" | "reset-password" | "verify";
  onNavigate: (view: string) => void;
}

export const AuthPages: React.FC<AuthPageProps> = ({ initialView, onNavigate }) => {
  const {
    user,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    resendVerification,
    isConfigured
  } = useAuth();

  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setView(initialView);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialView]);

  // Handle countdown for resend email button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // If user is already verified and logged in, offer to redirect to meetings
  useEffect(() => {
    if (user && user.emailConfirmed && (view === "login" || view === "signup")) {
      onNavigate("companion-dashboard");
    }
  }, [user, view, onNavigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMessage(error);
      } else {
        // Successful login
        window.location.hash = "#/meetings";
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password || !confirmPassword) {
      setErrorMessage("All required fields must be completed.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters in length.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify.");
      return;
    }

    setIsLoading(true);
    try {
      const { error, requiresVerification } = await signUp(email, password, name);
      if (error) {
        setErrorMessage(error);
      } else if (requiresVerification) {
        setVerificationSentTo(email);
        setView("verify");
      } else {
        setSuccessMessage("Account created successfully. Redirecting...");
        setTimeout(() => {
          window.location.hash = "#/meetings";
        }, 1500);
      }
    } catch {
      setErrorMessage("An unexpected error occurred during signup.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage("Please enter your account email address.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await requestPasswordReset(email);
      if (error) {
        setErrorMessage(error);
      } else {
        // Neutral confirmation to prevent account enumeration
        setSuccessMessage(
          `If an account exists for ${email}, a password reset link has been dispatched. Please check your inbox and spam folder.`
        );
      }
    } catch {
      setErrorMessage("Failed to send reset email. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!password || !confirmPassword) {
      setErrorMessage("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setErrorMessage(error);
      } else {
        setSuccessMessage("Your password has been successfully updated. You may now log in.");
        setTimeout(() => {
          window.location.hash = "#/login";
        }, 2000);
      }
    } catch {
      setErrorMessage("Failed to update password. Recovery session may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    const targetEmail = verificationSentTo || email;
    if (!targetEmail) {
      setErrorMessage("Please enter your email address to resend confirmation.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await resendVerification(targetEmail);
      if (error) {
        setErrorMessage(error);
      } else {
        setSuccessMessage(`A new verification link has been sent to ${targetEmail}.`);
        setResendCooldown(60);
      }
    } catch {
      setErrorMessage("Failed to resend confirmation link.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 68px)",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 20px"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          padding: "36px 32px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}
      >
        {/* Top Logo and Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#/";
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              marginBottom: "16px"
            }}
          >
            <Logo size={28} />
          </a>

          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 600,
              color: "#111111",
              margin: 0,
              letterSpacing: "-0.01em"
            }}
          >
            {view === "login" && "Log in to VoxFlow"}
            {view === "signup" && "Create your account"}
            {view === "forgot-password" && "Reset your password"}
            {view === "reset-password" && "Set a new password"}
            {view === "verify" && "Verify your email"}
          </h1>

          <p
            style={{
              fontSize: "0.875rem",
              color: "#666666",
              margin: "8px 0 0 0",
              lineHeight: 1.4
            }}
          >
            {view === "login" && "Enter your credentials to access your meetings and dashboard."}
            {view === "signup" && "Get started with AI voice typing and intelligent meeting notes."}
            {view === "forgot-password" && "Enter your email to receive a secure recovery link."}
            {view === "reset-password" && "Choose a strong password with at least 8 characters."}
            {view === "verify" && "Complete your registration to access protected features."}
          </p>
        </div>

        {/* Configuration Notice if Supabase keys missing */}
        {!isConfigured && (
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: "#f9f9f9",
              border: "1px solid #e5e5e5",
              borderRadius: "6px",
              marginBottom: "20px",
              fontSize: "0.8125rem",
              color: "#444444",
              lineHeight: 1.45
            }}
          >
            <strong>Note for Developer:</strong> Live Supabase authentication requires setting{" "}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{" "}
            <code>apps/web/.env</code>.
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: "10px 14px",
              backgroundColor: "#fff5f5",
              border: "1px solid #fed7d7",
              borderRadius: "6px",
              color: "#c53030",
              fontSize: "0.84375rem",
              marginBottom: "20px",
              lineHeight: 1.4
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "10px 14px",
              backgroundColor: "#f0fff4",
              border: "1px solid #c6f6d5",
              borderRadius: "6px",
              color: "#22543d",
              fontSize: "0.84375rem",
              marginBottom: "20px",
              lineHeight: 1.4
            }}
          >
            {successMessage}
          </div>
        )}

        {/* 1. LOGIN VIEW */}
        {view === "login" && (
          <form onSubmit={handleLogin} noValidate>
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="login-email"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "0.875rem",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#111111",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px"
                }}
              >
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: "0.84375rem",
                    fontWeight: 500,
                    color: "#111111"
                  }}
                >
                  Password
                </label>
                <a
                  href="#/forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = "#/forgot-password";
                  }}
                  style={{
                    fontSize: "0.8125rem",
                    color: "#666666",
                    textDecoration: "none"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111111")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
                >
                  Forgot password?
                </a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 12px",
                    fontSize: "0.875rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#888888",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "4px"
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "16px",
                backgroundColor: "#111111",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                transition: "background 0.15s ease"
              }}
            >
              {isLoading ? "Logging in..." : "Log In"}
            </button>

            <div
              style={{
                marginTop: "20px",
                textAlign: "center",
                fontSize: "0.84375rem",
                color: "#666666"
              }}
            >
              Don't have an account?{" "}
              <a
                href="#/signup"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "#/signup";
                }}
                style={{
                  color: "#111111",
                  fontWeight: 500,
                  textDecoration: "underline"
                }}
              >
                Sign up
              </a>
            </div>
          </form>
        )}

        {/* 2. SIGNUP VIEW */}
        {view === "signup" && (
          <form onSubmit={handleSignup} noValidate>
            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="signup-name"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Full Name (optional)
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "0.875rem",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#111111",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="signup-email"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "0.875rem",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#111111",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="signup-password"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Password (min. 8 characters)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 12px",
                    fontSize: "0.875rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#888888",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "4px"
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="signup-confirm-password"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 12px",
                    fontSize: "0.875rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#888888",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "4px"
                  }}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <p
              style={{
                fontSize: "0.75rem",
                color: "#666666",
                margin: "12px 0 16px 0",
                lineHeight: 1.4
              }}
            >
              By creating an account, you agree to our{" "}
              <a
                href="#/terms"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "#/terms";
                }}
                style={{ color: "#111111", textDecoration: "underline" }}
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "#/privacy";
                }}
                style={{ color: "#111111", textDecoration: "underline" }}
              >
                Privacy Policy
              </a>
              .
            </p>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#111111",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                transition: "background 0.15s ease"
              }}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>

            <div
              style={{
                marginTop: "20px",
                textAlign: "center",
                fontSize: "0.84375rem",
                color: "#666666"
              }}
            >
              Already have an account?{" "}
              <a
                href="#/login"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "#/login";
                }}
                style={{
                  color: "#111111",
                  fontWeight: 500,
                  textDecoration: "underline"
                }}
              >
                Log in
              </a>
            </div>
          </form>
        )}

        {/* 3. VERIFY EMAIL VIEW */}
        {view === "verify" && (
          <div>
            <div
              style={{
                padding: "16px",
                backgroundColor: "#f9f9f9",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                marginBottom: "20px",
                fontSize: "0.875rem",
                color: "#333333",
                lineHeight: 1.5
              }}
            >
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: "#111111" }}>
                Verify your email address
              </p>
              <p style={{ margin: "0 0 10px 0" }}>
                We sent a confirmation link to{" "}
                <strong>{verificationSentTo || email || "your email address"}</strong>.
              </p>
              <p style={{ margin: 0, color: "#666666", fontSize: "0.8125rem" }}>
                Please click the link in that email to confirm your address before accessing your
                meetings and workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isLoading || resendCooldown > 0}
              style={{
                width: "100%",
                padding: "9px",
                backgroundColor: "#ffffff",
                color: "#111111",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                fontSize: "0.84375rem",
                fontWeight: 500,
                cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                marginBottom: "12px",
                opacity: resendCooldown > 0 ? 0.6 : 1
              }}
            >
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : "Resend Verification Email"}
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.hash = "#/login";
              }}
              style={{
                width: "100%",
                padding: "9px",
                backgroundColor: "#111111",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.84375rem",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              Return to Login
            </button>
          </div>
        )}

        {/* 4. FORGOT PASSWORD VIEW */}
        {view === "forgot-password" && (
          <form onSubmit={handleForgotPassword} noValidate>
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="forgot-email"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Account Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "0.875rem",
                  border: "1px solid #e5e5e5",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "#ffffff",
                  color: "#111111",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#111111",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                transition: "background 0.15s ease"
              }}
            >
              {isLoading ? "Sending link..." : "Send Password Reset Link"}
            </button>

            <div
              style={{
                marginTop: "20px",
                textAlign: "center",
                fontSize: "0.84375rem",
                color: "#666666"
              }}
            >
              Remember your password?{" "}
              <a
                href="#/login"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "#/login";
                }}
                style={{
                  color: "#111111",
                  fontWeight: 500,
                  textDecoration: "underline"
                }}
              >
                Back to login
              </a>
            </div>
          </form>
        )}

        {/* 5. RESET PASSWORD VIEW */}
        {view === "reset-password" && (
          <form onSubmit={handleResetPassword} noValidate>
            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="reset-password"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                New Password (min. 8 characters)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 12px",
                    fontSize: "0.875rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#888888",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "4px"
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="reset-confirm-password"
                style={{
                  display: "block",
                  fontSize: "0.84375rem",
                  fontWeight: 500,
                  color: "#111111",
                  marginBottom: "6px"
                }}
              >
                Confirm New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 12px",
                    fontSize: "0.875rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#888888",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "4px"
                  }}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#111111",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                transition: "background 0.15s ease"
              }}
            >
              {isLoading ? "Updating password..." : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
