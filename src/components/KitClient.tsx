"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { computeWeakSpots } from "@/lib/kit/weakSpots";
import { PIPELINE_STEPS, type Flashcard, type Kit, type PartialKit, type QuestionCategory } from "@/lib/types";
import { categoryLabel, difficultyDots } from "@/lib/ui";

const categories: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

type KitError = { code?: string; message: string } | null;

function CoverageMeter({ kit }: { kit: Kit }) {
  const musts = kit.role.requirements.filter((r) => r.priority === "must");
  const covered = musts.filter((r) => !kit.coverage.uncovered_requirement_ids.includes(r.id)).length;
  const total = musts.length || 1;
  const pct = Math.round((covered / total) * 100);
  const clear = kit.coverage.uncovered_requirement_ids.length === 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>
          {covered}/{total} must-haves covered
        </span>
        <span className={`chip ${clear ? "chip-ok" : "chip-warn"}`}>{clear ? "Clear" : `${kit.coverage.uncovered_requirement_ids.length} open`}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[var(--line)] bg-[var(--background)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Must-have coverage">
        <div className="h-full bg-[var(--foreground)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[var(--ink-soft)]">Check passes: {kit.coverage.passes}</p>
    </div>
  );
}

export function KitClient({ id }: { id: string }) {
  const [kit, setKit] = useState<Kit | null>(null);
  const router = useRouter();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState("Loading…");
  const [dirty, setDirty] = useState(false);
  const [docStatus, setDocStatus] = useState<"loading" | "generating" | "ready" | "failed">("loading");
  const [progress, setProgress] = useState<string[]>([]);
  const [kitError, setKitError] = useState<KitError>(null);
  const [partial, setPartial] = useState<PartialKit | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string; bad?: boolean } | null>(null);
  const [records, setRecords] = useState<Record<string, number>>({});
  const toastSeq = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const polling = docStatus === "loading" || docStatus === "generating";

  useEffect(() => {
    if (docStatus !== "ready") return;
    let cancelled = false;
    fetch(`/api/kits/${id}/practice`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRecords(
          Object.fromEntries(
            ((d.records || []) as { flashcardId: string; confidence: number }[]).map((r) => [r.flashcardId, r.confidence]),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [docStatus, id]);

  function notify(msg: string, bad = false) {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, msg, bad });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/kits/${id}`);
        if (res.status === 401) return router.push("/login");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setDocStatus(data.status || "ready");
        setProgress(data.progress || []);
        setKitError(data.error || null);
        setPartial(data.partial || null);
        setWarnings(data.warnings || []);
        if (data.kit) {
          setKit(data.kit);
          setStatus("");
        }
      } catch {
        /* keep polling */
      }
    }
    const timer = setInterval(() => void load(), 1500);
    void load();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, polling, router]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save(nextKit = kit) {
    if (!nextKit) return;
    const res = await fetch(`/api/kits/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ kit: nextKit }),
      headers: { "content-type": "application/json" },
    });
    setDirty(false);
    if (res.ok) notify("Changes saved");
    else notify("Save failed", true);
  }

  function updateQuestion(qid: string, patch: Record<string, unknown>) {
    if (!kit) return;
    const next = {
      ...kit,
      questions: kit.questions.map((q) => (q.id === qid ? { ...q, ...patch, meta: { ...q.meta, edited: true } } : q)),
    };
    setKit(next);
    setDirty(true);
  }

  function moveQuestion(qid: string, direction: -1 | 1) {
    if (!kit) return;
    const questions = [...kit.questions];
    const index = questions.findIndex((q) => q.id === qid);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= questions.length) return;
    [questions[index], questions[swap]] = [questions[swap], questions[index]];
    const next = { ...kit, questions };
    setKit(next);
    save(next);
  }

  function addQuestion(category: QuestionCategory) {
    if (!kit) return;
    const taken = new Set(kit.questions.map((q) => q.id));
    let n = kit.questions.length + 1;
    while (taken.has(`q-user-${n}`)) n += 1;
    const next = {
      ...kit,
      questions: [
        ...kit.questions,
        {
          id: `q-user-${n}`,
          requirement_ids: [],
          category,
          prompt: "New question",
          answer_outline: "Add your outline.",
          difficulty: 1 as const,
          meta: { origin: "user" as const, edited: true, pinned: true },
        },
      ],
    };
    setKit(next);
    setDirty(true);
  }

  function updateFlashcard(fid: string, patch: Partial<Flashcard>) {
    if (!kit) return;
    const next = {
      ...kit,
      flashcards: kit.flashcards.map((f) => (f.id === fid ? { ...f, ...patch, meta: { ...f.meta, edited: true } } : f)),
    };
    setKit(next);
    setDirty(true);
  }

  function addFlashcard() {
    if (!kit) return;
    const taken = new Set(kit.flashcards.map((f) => f.id));
    let n = kit.flashcards.length + 1;
    while (taken.has(`f-user-${n}`)) n += 1;
    const next = {
      ...kit,
      flashcards: [
        ...kit.flashcards,
        {
          id: `f-user-${n}`,
          front: "New flashcard",
          back: "Add the answer.",
          requirement_ids: [],
          meta: { origin: "user" as const, edited: true, pinned: true },
        },
      ],
    };
    setKit(next);
    setDirty(true);
  }

  async function regenerate(section: string, category?: QuestionCategory) {
    const res = await fetch(`/api/kits/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ section, category }),
      headers: { "content-type": "application/json" },
    });
    const data = await res.json();
    if (data.kit) setKit(data.kit);
    if (res.ok) notify("Section regenerated");
    else notify(data.error?.message || "Regeneration failed", true);
  }

  if (docStatus === "generating" || docStatus === "loading") {
    return (
      <>
        <AppHeader action={<Link className="page-back" href="/dashboard">Back to dashboard</Link>} />
        <section className="card-raised mx-auto max-w-2xl p-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Generating your kit…</h1>
          <p className="mt-3 text-[var(--ink-soft)]">Each step is saved as it finishes. You can leave this page and come back later.</p>
          <ol className="mt-6 space-y-3">
            {(() => {
              const firstPending = PIPELINE_STEPS.find((step) => !progress.includes(step));
              return PIPELINE_STEPS.map((step) => {
                const done = progress.includes(step);
                return (
                  <li className="flex items-center gap-3 text-base" key={step}>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-[var(--line)] text-sm font-bold ${
                        done ? "bg-[var(--foreground)] text-[var(--surface)]" : "bg-[var(--surface)]"
                      } ${!done && step === firstPending ? "pulse" : ""}`}
                      aria-hidden
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span className={done ? "" : "text-[var(--ink-soft)]"}>{step}</span>
                    {done ? <span className="sr-only">done</span> : <span className="sr-only">pending</span>}
                  </li>
                );
              });
            })()}
          </ol>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--ink-soft)]">
              <span>Progress</span>
              <span>
                {progress.length}/{PIPELINE_STEPS.length}
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={Math.round((progress.length / PIPELINE_STEPS.length) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Generation progress"
            >
              <div className="progress-fill" style={{ width: `${(progress.length / PIPELINE_STEPS.length) * 100}%` }} />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (docStatus === "failed") {
    return (
      <>
        <AppHeader action={<Link className="page-back" href="/dashboard">Back to dashboard</Link>} />
        <section className="card-raised mx-auto max-w-2xl p-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Generation failed</h1>
          <p className="notice notice-bad mt-4" role="alert">
            {kitError?.message || "Something went wrong while generating this kit."}
          </p>
          {partial ? (
            <div className="card mt-6 p-5">
              <p className="font-extrabold">Partial results were preserved</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
                {partial.role?.title ? <li>Role: {partial.role.title}</li> : null}
                {partial.role?.requirements?.length ? <li>Requirements extracted: {partial.role.requirements.length}</li> : null}
                {partial.questions?.length ? <li>Questions generated: {partial.questions.length}</li> : null}
                {partial.research_notes?.length ? partial.research_notes.map((note) => <li key={note}>{note}</li>) : null}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-[var(--ink-soft)]">No partial results were produced before the failure.</p>
          )}
          <div className="mt-6 flex gap-3">
            <button
              className="btn btn-lg btn-solid"
              onClick={async () => {
                setKitError(null);
                setStatus("Retrying…");
                const res = await fetch(`/api/kits/${id}/retry`, { method: "POST" });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  setProgress([]);
                  setDocStatus(data.status || "generating");
                  setStatus("");
                } else {
                  setKitError(data.error || { message: "Retry failed." });
                }
              }}
            >
              Retry generation
            </button>
          </div>
        </section>
      </>
    );
  }

  if (!kit) {
    return (
      <>
        <AppHeader action={<Link className="page-back" href="/dashboard">Back to dashboard</Link>} />
        <p className="card mx-auto max-w-md p-6" role="status">
          {status}
        </p>
      </>
    );
  }

  const byCategory = Object.fromEntries(categories.map((c) => [c, kit.questions.filter((q) => q.category === c)])) as Record<
    QuestionCategory,
    Kit["questions"]
  >;
  const weakSpots = computeWeakSpots(kit, records);

  return (
    <>
      <AppHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-solid" onClick={() => save()}>
              Save changes
            </button>
            <button className="btn btn-sm" onClick={() => regenerate("schedule")}>
              Regenerate schedule
            </button>
            <Link className="btn btn-sm" href={`/kits/${id}/practice`}>
              Practice
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
        <aside className="space-y-4">
          <Link className="page-back inline-block" href="/dashboard">
            Back to dashboard
          </Link>

          <section className="card-raised p-5">
            <p className="text-xs font-bold text-[var(--ink-soft)]">{kit.source.company}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-snug tracking-tight">{kit.role.title}</h1>
            {kit.source.location ? <p className="mt-1 text-sm text-[var(--ink-soft)]">{kit.source.location}</p> : null}
            <Link className="btn btn-lg btn-solid mt-4 w-full" href={`/kits/${id}/practice`}>
              Practice flashcards
            </Link>
          </section>

          <section className="card p-5">
            <h2 className="section-title">Coverage</h2>
            <div className="mt-3">
              <CoverageMeter kit={kit} />
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Weak spots</h2>
              {weakSpots.length ? (
                <span className={`chip ${weakSpots.some((s) => s.level === "bad") ? "chip-bad" : "chip-warn"}`}>
                  {weakSpots.length} open
                </span>
              ) : (
                <span className="chip chip-ok">Clear</span>
              )}
            </div>
            {weakSpots.length ? (
              <>
                <ul className="mt-3 space-y-2">
                  {weakSpots.map((spot) => (
                    <li className="rounded-xl border-2 border-[var(--line)] bg-[var(--background)] p-3" key={spot.id}>
                      <p className={`text-sm font-bold leading-snug ${spot.level === "bad" ? "text-[var(--bad)]" : ""}`}>
                        {spot.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{spot.detail}</p>
                    </li>
                  ))}
                </ul>
                <Link className="btn btn-sm mt-3" href={`/kits/${id}/practice`}>
                  Practise weak cards
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Coverage is clear and no cards are shaky. Weak spots reappear here as gaps or low practice scores show up.
              </p>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Company brief</h2>
              <button className="btn btn-sm" onClick={() => regenerate("company_brief")}>
                Regenerate
              </button>
            </div>
            <label className="label mt-3" htmlFor="brief-summary">
              Summary
            </label>
            <textarea
              className="field min-h-28"
              id="brief-summary"
              value={kit.company_brief.summary}
              onChange={(e) => {
                setDirty(true);
                setKit({
                  ...kit,
                  company_brief: { ...kit.company_brief, summary: e.target.value, meta: { ...kit.company_brief.meta, edited: true } },
                });
              }}
            />
            <label className="label mt-3" htmlFor="brief-do">
              What they do
            </label>
            <textarea
              className="field min-h-32"
              id="brief-do"
              value={kit.company_brief.what_they_do}
              onChange={(e) => {
                setDirty(true);
                setKit({
                  ...kit,
                  company_brief: { ...kit.company_brief, what_they_do: e.target.value, meta: { ...kit.company_brief.meta, edited: true } },
                });
              }}
            />
          </section>

          {warnings.length ? (
            <section className="card border-amber-700 bg-amber-50 p-5">
              <h2 className="section-title">Research notes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        <section className="space-y-6">
          {categories.map((category) => (
            <section className="card p-5" key={category}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold tracking-tight">
                  {categoryLabel[category]}
                  <span className="ml-2 text-sm font-semibold text-[var(--ink-soft)]">{byCategory[category].length}</span>
                </h2>
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={() => addQuestion(category)}>
                    Add
                  </button>
                  <button className="btn btn-sm" onClick={() => regenerate("questions", category)}>
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {byCategory[category].map((q) => (
                  <article className="card p-4" key={q.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button className="btn btn-sm btn-icon" aria-label="Move question up" onClick={() => moveQuestion(q.id, -1)}>
                        ↑
                      </button>
                      <button className="btn btn-sm btn-icon" aria-label="Move question down" onClick={() => moveQuestion(q.id, 1)}>
                        ↓
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        aria-label="Delete question"
                        onClick={() => {
                          setDirty(true);
                          setKit({ ...kit, questions: kit.questions.filter((item) => item.id !== q.id) });
                        }}
                      >
                        Delete
                      </button>
                      <label className="sr-only" htmlFor={`cat-${q.id}`}>
                        Category
                      </label>
                      <select
                        className="select"
                        id={`cat-${q.id}`}
                        value={q.category}
                        onChange={(e) => updateQuestion(q.id, { category: e.target.value })}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {categoryLabel[c]}
                          </option>
                        ))}
                      </select>
                      <span className="chip ml-auto" title="Difficulty">
                        {difficultyDots(q.difficulty)}
                      </span>
                      {q.meta?.pinned ? <span className="chip chip-solid">Pinned</span> : null}
                      {q.meta?.edited ? <span className="chip">Edited</span> : null}
                    </div>

                    <label className="label" htmlFor={`prompt-${q.id}`}>
                      Question
                    </label>
                    <textarea
                      className="field font-semibold"
                      id={`prompt-${q.id}`}
                      value={q.prompt}
                      onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                    />
                    <label className="label mt-2" htmlFor={`outline-${q.id}`}>
                      Answer outline
                    </label>
                    <textarea
                      className="field min-h-24"
                      id={`outline-${q.id}`}
                      value={q.answer_outline}
                      onChange={(e) => updateQuestion(q.id, { answer_outline: e.target.value })}
                    />
                    <p className="mt-2 text-xs text-[var(--ink-soft)]">
                      Covers: {q.requirement_ids.join(", ") || "manual"}
                      {dirty ? " · Unsaved changes" : ""}
                    </p>
                  </article>
                ))}
                {!byCategory[category].length ? (
                  <p className="rounded-xl border-2 border-dashed border-[var(--line)] p-4 text-sm text-[var(--ink-soft)]">
                    No questions in this category yet.
                  </p>
                ) : null}
              </div>
            </section>
          ))}

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">
                Flashcards
                <span className="ml-2 text-sm font-semibold text-[var(--ink-soft)]">{kit.flashcards.length}</span>
              </h2>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => addFlashcard()}>
                  Add
                </button>
                <button className="btn btn-sm" onClick={() => regenerate("flashcards")}>
                  Regenerate
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {kit.flashcards.map((f) => (
                <article className="card p-4" key={f.id}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      className="btn btn-sm btn-danger"
                      aria-label="Delete flashcard"
                      onClick={() => {
                        setDirty(true);
                        setKit({ ...kit, flashcards: kit.flashcards.filter((item) => item.id !== f.id) });
                      }}
                    >
                      Delete
                    </button>
                    {f.meta?.edited ? <span className="chip">Edited</span> : null}
                    <span className="ml-auto text-xs text-[var(--ink-soft)]">
                      Covers: {f.requirement_ids.join(", ") || "manual"}
                      {dirty ? " · Unsaved changes" : ""}
                    </span>
                  </div>
                  <label className="label" htmlFor={`front-${f.id}`}>
                    Front
                  </label>
                  <textarea
                    className="field font-semibold"
                    id={`front-${f.id}`}
                    value={f.front}
                    onChange={(e) => updateFlashcard(f.id, { front: e.target.value })}
                  />
                  <label className="label mt-2" htmlFor={`back-${f.id}`}>
                    Back
                  </label>
                  <textarea
                    className="field min-h-24"
                    id={`back-${f.id}`}
                    value={f.back}
                    onChange={(e) => updateFlashcard(f.id, { back: e.target.value })}
                  />
                </article>
              ))}
              {!kit.flashcards.length ? (
                <p className="rounded-xl border-2 border-dashed border-[var(--line)] p-4 text-sm text-[var(--ink-soft)]">
                  No flashcards yet. Add one by hand or regenerate.
                </p>
              ) : null}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-extrabold tracking-tight">Schedule</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{kit.schedule.days_available}-day plan · integer minutes · must-haves first</p>
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {kit.schedule.days.map((day) => (
                <li className="flex gap-3 rounded-2xl border-2 border-[var(--line)] bg-[var(--background)] p-4" key={day.day}>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-extrabold text-[var(--surface)]">
                    {day.day}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{day.focus}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {day.minutes} min
                      {day.question_ids.length ? ` · ${day.question_ids.length} question${day.question_ids.length === 1 ? "" : "s"}` : ""}
                    </p>
                    {day.question_ids.length ? (
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">{day.question_ids.join(", ")}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </div>

      {toast ? (
        <div className={`toast${toast.bad ? " toast-bad" : ""}`} key={toast.id} role="status">
          {toast.msg}
        </div>
      ) : null}
    </>
  );
}
