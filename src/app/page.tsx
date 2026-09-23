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
