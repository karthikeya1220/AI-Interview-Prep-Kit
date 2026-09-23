"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const next: { email?: string; password?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (next.email || next.password) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData)),
      headers: { "content-type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error?.message || "Authentication failed.");
    router.push("/dashboard");
  }

  return (
    <form action={submit} noValidate className="card-raised mx-auto flex max-w-md flex-col gap-5 p-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{mode === "login" ? "Log in" : "Create account"}</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          {mode === "login" ? "Pick up where you left off." : "Save kits, edit questions, and track practice."}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="auth-email">
          Email
        </label>
        <input
          className="field"
          id="auth-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
        />
        {fieldErrors.email ? (
          <p className="mt-1.5 text-xs font-semibold text-[var(--bad)]" id="auth-email-error">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div>
        <label className="label" htmlFor="auth-password">
          Password
        </label>
        <input
          className="field"
          id="auth-password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
        />
        {fieldErrors.password ? (
          <p className="mt-1.5 text-xs font-semibold text-[var(--bad)]" id="auth-password-error">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="notice notice-bad" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-lg btn-solid w-full" disabled={loading}>
        {loading ? "Working…" : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
