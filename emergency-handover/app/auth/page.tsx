"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, isEmailTaken, login, logout, signUp } from "../../lib/local-auth";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentNickname, setCurrentNickname] = useState("");

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentNickname(user?.nickname ?? "");
  }, []);

  const heading = useMemo(() => (mode === "login" ? "Login" : "Create account"), [mode]);

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    resetMessages();

    if (mode === "signup") {
      if (isEmailTaken(email)) {
        setError("This email is already registered.");
        return;
      }

      const result = signUp({ email, password, nickname });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSuccess("Account created. Redirecting...");
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const result = login({ email, password });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess("Logged in. Redirecting...");
    router.push(redirectTo);
    router.refresh();
  }

  function handleLogout() {
    logout();
    setCurrentNickname("");
    setSuccess("Logged out.");
    setError("");
  }

  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 20px 72px" }}>
      <section
        style={{
          borderRadius: "28px",
          padding: "32px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)",
          color: "#ffffff",
          boxShadow: "0 24px 60px rgba(30, 58, 138, 0.22)",
          marginBottom: "24px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "14px", opacity: 0.9 }}>
          LOCAL AUTH
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: "38px", fontWeight: 900 }}>
          {heading}
        </h1>
        <p style={{ margin: 0, maxWidth: "520px", lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }}>
          Use a local account to create team posts and save submissions. Read-only pages stay public.
        </p>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "24px",
          padding: "24px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              resetMessages();
            }}
            style={{
              padding: "12px 16px",
              borderRadius: "14px",
              border: mode === "login" ? "1px solid #2563eb" : "1px solid #d1d5db",
              background: mode === "login" ? "#eff6ff" : "#ffffff",
              color: mode === "login" ? "#2563eb" : "#374151",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              resetMessages();
            }}
            style={{
              padding: "12px 16px",
              borderRadius: "14px",
              border: mode === "signup" ? "1px solid #2563eb" : "1px solid #d1d5db",
              background: mode === "signup" ? "#eff6ff" : "#ffffff",
              color: mode === "signup" ? "#2563eb" : "#374151",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Sign up
          </button>
        </div>

        {currentNickname ? (
          <div
            style={{
              borderRadius: "18px",
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              padding: "18px",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontWeight: 800, color: "#111827", marginBottom: "8px" }}>
              Signed in as {currentNickname}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link
                href={redirectTo}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Continue
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: "12px 16px",
                  borderRadius: "14px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          {mode === "signup" && (
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
                Nickname
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="builder"
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0 14px",
                  borderRadius: "14px",
                  border: "1px solid #d1d5db",
                  background: "#fbfcfe",
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                background: "#fbfcfe",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 4 characters"
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                background: "#fbfcfe",
              }}
            />
          </div>

          {error ? (
            <div
              style={{
                borderRadius: "14px",
                padding: "12px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              style={{
                borderRadius: "14px",
                padding: "12px 14px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontWeight: 700,
              }}
            >
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 16px",
              borderRadius: "14px",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
            }}
          >
            {mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
