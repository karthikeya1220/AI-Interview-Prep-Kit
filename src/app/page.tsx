import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto mb-8 flex max-w-6xl items-center justify-between">
        <span className="text-sm font-bold">AI Interview Prep Kit</span>
        <div className="flex gap-2">
          <Link className="btn btn-sm" href="/login">
            Log in
          </Link>
        </div>
      </div>

      <section className="card-raised mx-auto grid max-w-6xl gap-10 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
            Turn a posting into a defensible prep plan.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
            Paste a job description, give the company URL, and generate a structured kit with research notes, questions, flashcards, coverage checks, and an exact-day study schedule.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link className="btn btn-lg btn-solid" href="/register">
              Create account
            </Link>
            <Link className="btn btn-lg" href="/login">
              Log in
            </Link>
          </div>

          <div className="card mt-10 max-w-md p-4" aria-hidden>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--ink-soft)]">Coverage</span>
              <span className="chip chip-ok">Clear</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[var(--line)] bg-[var(--background)]">
              <div className="h-full w-full bg-[var(--foreground)]" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3].map((d) => (
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--foreground)] text-xs font-extrabold text-[var(--surface)]"
                  key={d}
                >
                  {d}
                </span>
              ))}
              <span className="text-xs font-semibold text-[var(--ink-soft)]">exact-day schedule</span>
            </div>
            <div className="mt-4 space-y-2 border-t-2 border-[var(--line)] pt-3">
              <div className="h-3 w-full rounded-full bg-[#e9e3d6]" />
              <div className="h-3 w-5/6 rounded-full bg-[#e9e3d6]" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--foreground)] p-6 text-[var(--surface)]">
          <p className="text-lg font-extrabold">Pipeline checklist</p>
          <ol className="mt-6 space-y-5 text-sm leading-6">
            {[
              "Extract must-have and nice-to-have requirements.",
              "Crawl company pages and record missing sources honestly.",
              "Generate questions by category, then close coverage gaps.",
              "Edit, reorder, regenerate, and practice without losing work.",
            ].map((item, i) => (
              <li className="flex gap-3" key={item}>
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--surface)] text-xs font-bold">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
