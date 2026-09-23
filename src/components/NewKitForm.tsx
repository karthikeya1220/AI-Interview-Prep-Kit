"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BulkCase = { jd?: unknown; company_url?: unknown; days?: unknown };

export function NewKitForm() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [jd, setJd] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [fileError, setFileError] = useState("");
  const router = useRouter();

  async function createKit(payload: { jd: string; company_url: string; days: number }): Promise<boolean> {
    const res = await fetch("/api/kits", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    return res.ok;
  }

  async function submit(formData: FormData) {
    setError("");
    const payload = Object.fromEntries(formData);
    try {
      new URL(String(payload.company_url || ""));
    } catch {
      setError("Enter a full company URL, like https://company.com.");
      return;
    }
    const days = Number(payload.days);
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      setError("Days until interview must be a whole number between 1 and 60.");
      return;
    }
    const jdText = String(payload.jd || "").trim();
    if (!jdText) {
      setError("Paste the job description — thin postings are fine, empty ones are not.");
      return;
    }
    setStatus("Creating kit… generation continues in the background.");
    const ok = await createKit({ jd: jdText, company_url: String(payload.company_url), days });
    if (!ok) {
      setStatus("");
      setError("Generation failed to start.");
      return;
    }
    router.push("/dashboard");
  }

  async function uploadPairs(file: File) {
    setFileError("");
    setFileStatus("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BulkCase[];
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("File must be a non-empty JSON array.");
      const cases = parsed.map((item) => ({
        jd: String(item.jd || ""),
        company_url: String(item.company_url || ""),
        days: Number(item.days) || 5,
      }));
      const invalid = cases.find((c) => !c.jd.trim() || !c.company_url.trim() || !Number.isInteger(c.days) || c.days < 1 || c.days > 60);
      if (invalid) throw new Error('Each entry needs { "jd", "company_url", "days": 1–60 }.');
      setFileStatus(`Creating ${cases.length} kit${cases.length === 1 ? "" : "s"}…`);
      let created = 0;
      for (const c of cases) {
        if (await createKit(c)) created += 1;
      }
      if (!created) throw new Error("No kits could be created — are you signed in?");
      setFileStatus(`${created} kit${created === 1 ? "" : "s"} queued. Opening dashboard…`);
      router.push("/dashboard");
    } catch (err) {
      setFileStatus("");
      setFileError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  return (
    <div className="space-y-6">
      <form action={submit} noValidate className="card-raised p-6 md:p-8">
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
              placeholder="Paste the full posting — or a two-line stub; the kit stays honest about thin input."
              autoComplete="off"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              required
            />
            {jd.trim().length > 0 && jd.trim().length < 80 ? (
              <p className="mt-1.5 text-xs text-[var(--ink-soft)]">Short description — the kit will be thin and say so rather than invent requirements.</p>
            ) : null}
          </div>
        </div>

        {status ? (
          <p className="notice notice-warn mt-5" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="notice notice-bad mt-5" role="alert">
            {error}
          </p>
        ) : null}

        <button className="btn btn-lg btn-solid mt-6">Generate kit</button>
      </form>

      <section className="card-raised p-6 md:p-8">
        <h2 className="text-xl font-extrabold tracking-tight">Prepare for more than one role</h2>
        <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]">
          Upload a JSON file of description-and-company pairs to queue several kits at once:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-[var(--foreground)] p-3 text-xs text-[var(--surface)]">{`[
  { "jd": "Senior Backend Engineer…", "company_url": "https://acme.com", "days": 5 },
  { "jd": "Staff Platform…", "company_url": "https://globex.com", "days": 7 }
]`}</pre>
        <label className="btn btn-solid mt-4 inline-flex cursor-pointer" htmlFor="pairs-file">
          Choose cases file
          <input
            className="sr-only"
            id="pairs-file"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPairs(file);
              e.target.value = "";
            }}
          />
        </label>
        {fileStatus ? (
          <p className="notice notice-warn mt-4" role="status">
            {fileStatus}
          </p>
        ) : null}
        {fileError ? (
          <p className="notice notice-bad mt-4" role="alert">
            {fileError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
