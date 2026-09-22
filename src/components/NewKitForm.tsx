"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewKitForm() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [jd, setJd] = useState("");
  const router = useRouter();

  async function submit(formData: FormData) {
    setError("");
    setStatus("Creating kit… generation continues in the background.");
    const payload = Object.fromEntries(formData);
    const res = await fetch("/api/kits", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("");
      setError(data.error?.message || "Generation failed.");
      return;
    }
    router.push(`/kits/${data.id}`);
  }

  return (
    <form action={submit} className="card-raised p-6 md:p-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Create kit</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]">
        We extract requirements, crawl the company site (robots.txt respected), then generate questions, flashcards, coverage, and an exact-day schedule.
      </p>

      <div className="mt-6 grid gap-5">
        <div>
          <label className="label" htmlFor="kit-url">
            Company website
          </label>
          <input
            className="field"
            id="kit-url"
            name="company_url"
            type="url"
            placeholder="https://company.com"
            autoComplete="off"
            required
          />
        </div>

        <div className="max-w-xs">
          <label className="label" htmlFor="kit-days">
            Days until interview
          </label>
          <input
            className="field"
            id="kit-days"
            name="days"
            type="number"
            min="1"
            max="60"
            defaultValue="5"
            autoComplete="off"
            required
          />
          <p className="mt-1.5 text-xs text-[var(--ink-soft)]">1–60. Must-have topics land earlier in the plan.</p>
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <label className="label mb-0" htmlFor="kit-jd">
              Job description
            </label>
            <span className="text-xs text-[var(--ink-soft)]">{jd.length.toLocaleString()} characters</span>
          </div>
          <textarea
            className="field mt-1.5 min-h-72 resize-y"
            id="kit-jd"
            name="jd"
            placeholder="Paste the full posting — responsibilities, requirements, nice-to-haves…"
            autoComplete="off"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            required
          />
        </div>
      </div>

      {status ? (
        <p className="mt-5 rounded-xl border-2 border-amber-700 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-xl border-2 border-[var(--bad)] bg-red-50 p-3 text-sm text-[var(--bad)]" role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn btn-solid mt-6">Generate kit</button>
    </form>
  );
}
