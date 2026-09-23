"use client";

import Link from "next/link";
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
  const [kit, setKit] = useState<Kit | null>(null);
  const [records, setRecords] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/kits/${id}`).then((r) => r.json()),
      fetch(`/api/kits/${id}/practice`).then((r) => r.json()),
    ]).then(([kitData, practiceData]) => {
      setKit(kitData.kit);
      setRecords(
        Object.fromEntries(
          ((practiceData.records || []) as PracticeRecord[]).map((r) => [r.flashcardId, r.confidence]),
        ),
      );
    });
  }, [id]);

  if (!kit) {
    return (
      <>
        <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
        <p className="card mx-auto max-w-md p-6" role="status">
          Loading practice session…
        </p>
      </>
    );
  }

  const cards = [...kit.flashcards].sort((a, b) => (records[a.id] || 0) - (records[b.id] || 0));
  const card = cards[index] || cards[0];
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

  async function rate(confidence: number) {
    setRecords({ ...records, [card.id]: confidence });
    await fetch(`/api/kits/${id}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcardId: card.id, confidence }),
      headers: { "content-type": "application/json" },
    });
    setRevealed(false);
    setIndex((index + 1) % cards.length);
  }

  const covered = Object.keys(records).length;
  const pct = cards.length ? Math.round((covered / cards.length) * 100) : 0;
  const position = (index % cards.length) + 1;

  return (
    <>
      <AppHeader action={<Link className="page-back" href={`/kits/${id}`}>Back to kit</Link>} />
      <section className="card-raised mx-auto max-w-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Flashcard practice</h1>
          <span className="chip">
            {position}/{cards.length}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Covered {covered} of {cards.length}. Least confident cards appear first next session.
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
