"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import type { Kit } from "@/lib/types";

type PracticeRecord = { flashcardId: string; confidence: number };

const scale = [
  { score: 1, label: "1 · Blank" },
  { score: 2, label: "2 · Shaky" },
  { score: 3, label: "3 · OK" },
  { score: 4, label: "4 · Solid" },
  { score: 5, label: "5 · Nailed it" },
];

export function PracticeClient({ id }: { id: string }) {
  const router = useRouter();
  const [kit, setKit] = useState<Kit | null>(null);
  const [records, setRecords] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [filed, setFiled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/kits/${id}`).then(async (r) => {
        if (r.status === 401) return { status: 401 as const, data: {} };
        const data = await r.json().catch(() => ({}));
        return { status: r.status, data };
      }),
      fetch(`/api/kits/${id}/practice`).then(async (r) => {
        if (r.status === 401) return { status: 401 as const, data: {} };
        const data = await r.json().catch(() => ({}));
        return { status: r.status, data };
      }),
    ])
      .then(([kitRes, practiceRes]) => {
        if (cancelled) return;
        if (kitRes.status === 401 || practiceRes.status === 401) {
          router.push("/login");
          return;
        }
        if (kitRes.status !== 200) {
          setLoadError(kitRes.data?.error?.message || "Could not load this kit.");
          return;
        }
        setKit(kitRes.data.kit);
        setRecords(
          Object.fromEntries(
            ((practiceRes.data.records || []) as PracticeRecord[]).map((r) => [r.flashcardId, r.confidence]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setLoadError("Network error while loading practice. Check your connection and retry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const cards = kit ? [...kit.flashcards].sort((a, b) => (records[a.id] || 0) - (records[b.id] || 0)) : [];
  const card = cards[index] || cards[0] || null;

  useEffect(() => {
    if (!filed) return;
    const t = setTimeout(() => setFiled(false), 1400);
    return () => clearTimeout(t);
  }, [filed]);

  async function rate(confidence: number) {
    if (!card) return;
    setRecords({ ...records, [card.id]: confidence });
    await fetch(`/api/kits/${id}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcardId: card.id, confidence }),
      headers: { "content-type": "application/json" },
    }).catch(() => {});
    setRevealed(false);
    setFiled(true);
    setIndex((index + 1) % cards.length);
  }

  useEffect(() => {
    if (!card) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (t instanceof HTMLButtonElement) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        void rate(Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) {
    return (
      <>
        <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
        <div className="card-raised mx-auto max-w-2xl p-6 md:p-8" role="status" aria-label="Loading practice session">
          <span className="sr-only">Loading practice session…</span>
          <div aria-hidden>
            <div className="flex items-baseline justify-between gap-2">
              <div className="sk h-8 w-56" />
              <div className="sk h-7 w-12 !rounded-full" />
            </div>
            <div className="sk mt-4 h-4 w-3/4" />
            <div className="sk mt-3 h-3 w-full !rounded-full" />
            <div className="sk mt-8 h-56 w-full !rounded-2xl" />
            <div className="sk mt-6 h-4 w-40" />
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div className="sk h-9 w-24 !rounded-full" key={i} />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
        <section className="card-raised mx-auto max-w-lg p-8" role="alert">
          <h1 className="text-2xl font-extrabold tracking-tight">Practice unavailable</h1>
          <p className="notice notice-bad mt-4">{loadError}</p>
          <button className="btn btn-lg btn-solid mt-6" onClick={() => window.location.reload()} type="button">
            Try again
          </button>
        </section>
      </>
    );
  }

  if (!kit) {
    return (
      <>
        <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
        <section className="card-raised mx-auto max-w-lg p-8">
          <h1 className="text-2xl font-extrabold">Kit not ready</h1>
          <p className="mt-2 text-[var(--ink-soft)]">This kit has no content yet. Open it from the dashboard once generation finishes.</p>
          <Link className="btn btn-lg btn-solid mt-6" href="/dashboard">
            Back to dashboard
          </Link>
        </section>
      </>
    );
  }

  if (!card) {
    return (
      <>
        <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
        <section className="card-raised mx-auto max-w-lg p-8">
          <h1 className="text-2xl font-extrabold">No flashcards yet</h1>
          <p className="mt-2 text-[var(--ink-soft)]">Regenerate flashcards from the kit page, then come back to practice.</p>
        </section>
      </>
    );
  }

  const cardIds = new Set(cards.map((c) => c.id));
  const covered = Object.keys(records).filter((key) => cardIds.has(key)).length;
  const pct = cards.length ? Math.round((covered / cards.length) * 100) : 0;
  const position = (index % cards.length) + 1;

  return (
    <>
      <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
      <section className="card-raised mx-auto max-w-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Flashcard practice</h1>
          <div className="flex items-center gap-2">
            {filed ? (
              <span className="chip chip-ok" role="status">
                Card filed ✓
              </span>
            ) : null}
            <span className="chip">
              {position}/{cards.length}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Covered {covered} of {cards.length}. Least confident cards appear first next session.
          {!revealed ? " Press Space to reveal, then 1–5 to rate." : " Press 1–5 to rate."}
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-[var(--line)] bg-[var(--background)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Cards covered">
          <div className="h-full bg-[var(--foreground)]" style={{ width: `${pct}%` }} />
        </div>

        <article className="mt-8 min-h-56 rounded-2xl bg-[var(--foreground)] p-8 text-[var(--surface)]">
          <p className="text-xl font-extrabold leading-snug md:text-2xl">{card.front}</p>
          {revealed ? (
            <div className="mt-6 border-t border-white/25 pt-5">
              <p className="text-sm font-semibold text-white/60">Answer</p>
              <p className="mt-2 text-base leading-7 text-white/90">{card.back}</p>
            </div>
          ) : (
            <button className="btn btn-lg mt-8" onClick={() => setRevealed(true)}>
              Reveal answer
            </button>
          )}
        </article>

        {revealed ? (
          <div className="mt-6">
            <p className="label">How confident are you?</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {scale.map(({ score, label }) => (
                <button className="btn btn-sm" key={score} onClick={() => rate(score)} aria-label={`Rate ${label}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
