import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";

export const metadata = {
  title: "AI Interview Prep Kit — turn a job post into a prep plan",
  description:
    "Paste a job description and company URL. Get research notes, questions, flashcards, coverage checks, and an exact-day study schedule you can edit and practise.",
};

const kitContents = [
  {
    title: "Company brief",
    body: "Crawled about, careers, and hiring pages — with missing sources recorded honestly, never invented.",
    art: "brief",
  },
  {
    title: "Questions by category",
    body: "Technical, behavioural, system design, and company fit. Edit, pin, reorder, or regenerate a category without losing your work.",
    art: "questions",
  },
  {
    title: "Flashcards & weak spots",
    body: "Practise with confidence ratings. Uncovered requirements and shaky cards surface in one prioritised list.",
    art: "cards",
  },
  {
    title: "Exact-day schedule",
    body: "Must-have topics land earlier. Integer minutes, day-by-day, rebuilt whenever you change the questions.",
    art: "schedule",
  },
] as const;

const steps = [
  "Paste the posting, company URL, and days until interview.",
  "Requirements are extracted; company pages are crawled (robots.txt respected).",
  "Questions generate per category, then coverage closes remaining must-have gaps.",
  "You edit, reorder, regenerate, and practise — edits and pins survive.",
] as const;

function KitDossier() {
  return (
    <div className="relative" aria-hidden>
      <div className="card-raised relative z-10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--ink-soft)]">stripe.com</p>
            <p className="mt-0.5 text-lg font-extrabold leading-snug tracking-tight">Senior Backend Engineer</p>
          </div>
          <span className="chip chip-ok">Ready</span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold">
            <span>Must-have coverage</span>
            <span className="chip chip-ok">Clear</span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-[var(--line)] bg-[var(--background)]">
            <div className="h-full w-full bg-[var(--foreground)]" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { d: 1, focus: "Payment intents" },
            { d: 2, focus: "Idempotency" },
            { d: 3, focus: "Webhooks" },
          ].map((day) => (
            <div className="rounded-xl border-2 border-[var(--line)] bg-[var(--background)] p-2" key={day.d}>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--foreground)] text-[10px] font-extrabold text-[var(--surface)]">
                {day.d}
              </span>
              <p className="mt-1.5 text-[11px] font-bold leading-tight">{day.focus}</p>
              <p className="text-[10px] text-[var(--ink-soft)]">45 min</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-[var(--foreground)] p-3 text-[var(--surface)]">
          <p className="text-[10px] font-bold text-white/55">Flashcard · technical</p>
          <p className="mt-1 text-sm font-bold leading-snug">How do you make webhook delivery idempotent?</p>
        </div>
      </div>

      <div className="card absolute -right-3 -top-4 z-20 rotate-2 p-3 sm:-right-5">
        <p className="text-[10px] font-bold text-[var(--ink-soft)]">Weak spots</p>
        <p className="mt-1 text-xs font-extrabold text-[var(--bad)]">1 must-have open</p>
        <p className="text-[11px] text-[var(--ink-soft)]">Rate 1/5 · retry</p>
      </div>

      <div className="card absolute -bottom-5 -left-3 z-20 -rotate-2 p-3 sm:-left-5">
        <p className="text-[10px] font-bold text-[var(--ink-soft)]">Sources</p>
        <p className="mt-1 text-xs font-extrabold">3 pages used</p>
        <p className="text-[11px] text-[var(--ink-soft)]">Hiring · about · FAQ</p>
      </div>
    </div>
  );
}

function MiniArt({ kind }: { kind: (typeof kitContents)[number]["art"] }) {
  if (kind === "brief") {
    return (
      <div className="space-y-2" aria-hidden>
        <div className="h-2.5 w-3/4 rounded-full bg-[#e9e3d6]" />
        <div className="h-2.5 w-full rounded-full bg-[#e9e3d6]" />
        <div className="h-2.5 w-5/6 rounded-full bg-[#e9e3d6]" />
        <div className="flex gap-1.5 pt-1">
          <span className="chip chip-ok">about</span>
          <span className="chip chip-ok">careers</span>
        </div>
      </div>
    );
  }
  if (kind === "questions") {
    return (
      <div className="space-y-2" aria-hidden>
        {["Technical", "System design", "Company fit"].map((c) => (
          <div className="flex items-center justify-between rounded-lg border-2 border-[var(--line)] bg-[var(--background)] px-2 py-1.5" key={c}>
            <span className="text-[11px] font-bold">{c}</span>
            <span className="text-[10px] text-[var(--ink-soft)]">●●○</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "cards") {
    return (
      <div className="rounded-xl bg-[var(--foreground)] p-3 text-[var(--surface)]" aria-hidden>
        <p className="text-[10px] text-white/55">Front</p>
        <p className="mt-0.5 text-xs font-bold leading-snug">What breaks a retry queue?</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/40 text-[9px] font-bold" key={n}>
              {n}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((d) => (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--foreground)] text-xs font-extrabold text-[var(--surface)]" key={d}>
          {d}
        </span>
      ))}
    </div>
  );
}

export default async function Home() {
  let signedIn = false;
  try {
    signedIn = Boolean(await currentUserId());
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <Link className="text-sm font-extrabold tracking-tight" href="/">
          Prep Kit
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link className="btn btn-sm" href="/login">
            Log in
          </Link>
          <Link className="btn btn-sm btn-solid" href="/register">
            Create account
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 sm:px-10 sm:pb-24">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
                Turn a posting into a defensible prep plan.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
                Paste the job description, drop in the company URL, pick how many days you have. You get research notes, questions
                you can edit, flashcards you can practise, a coverage check that does not lie, and an exact-day schedule.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="btn btn-lg btn-solid" href="/register">
                  Create account
                </Link>
                <Link className="btn btn-lg" href="/login">
                  Log in
                </Link>
              </div>
              <p className="mt-5 text-sm text-[var(--ink-soft)]">
                Free to run locally with Ollama — no API key required.
              </p>
            </div>

            <div className="lg:pt-4">
              <KitDossier />
            </div>
          </div>
        </section>

        <section className="border-y-2 border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 sm:py-16">
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">What lands in your kit</h2>
            <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
              Every piece is editable. Regenerating a section keeps anything you wrote, pinned, or marked as edited.
            </p>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {kitContents.map((item) => (
                <li className="card p-5" key={item.title}>
                  <div className="min-h-20">
                    <MiniArt kind={item.art} />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold tracking-tight">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--ink-soft)]">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14 sm:px-10 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">How generation works</h2>
              <p className="mt-4 text-[var(--ink-soft)] leading-7">
                The model is not asked to allocate your schedule or decide final coverage — those steps are deterministic code, so
                the plan stays honest even when the model is wrong.
              </p>
              <div className="card mt-6 p-4">
                <p className="text-xs font-bold text-[var(--ink-soft)]">Batch mode</p>
                <code className="mt-2 block rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs text-[var(--surface)]">
                  npm run evaluate -- --input cases.json --output kits.json
                </code>
              </div>
            </div>
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <li className="card flex gap-4 p-4 sm:p-5" key={step}>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-extrabold text-[var(--surface)]">
                    {i + 1}
                  </span>
                  <p className="pt-1.5 text-sm leading-6 sm:text-base">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t-2 border-[var(--line)] bg-[var(--foreground)] text-[var(--surface)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-14 sm:px-10 sm:py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Start with one posting.</h2>
              <p className="mt-2 max-w-lg text-white/70">
                Create an account, paste a JD, and have a kit you can edit and practise in a few minutes.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="btn btn-lg" href="/register">
                Create account
              </Link>
              <Link className="btn btn-lg border-[var(--surface)] bg-transparent text-[var(--surface)] shadow-[3px_3px_0_var(--surface)] hover:shadow-[4px_4px_0_var(--surface)]" href="/login">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--ink-soft)] sm:px-10">
        <span className="font-bold text-[var(--foreground)]">Prep Kit</span>
        <nav className="flex gap-4" aria-label="Footer">
          <Link className="font-semibold underline underline-offset-2" href="/login">
            Log in
          </Link>
          <Link className="font-semibold underline underline-offset-2" href="/register">
            Create account
          </Link>
        </nav>
      </footer>
    </div>
  );
}
