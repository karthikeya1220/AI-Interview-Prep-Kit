"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hostnameOf } from "@/lib/ui";

type KitSummary = {
  _id: string;
  status?: string;
  createdAt: string;
  input?: { company_url?: string; days?: number };
  kit?: {
    role?: { title?: string };
    source?: { company?: string };
    coverage?: { uncovered_requirement_ids?: string[]; passes?: number };
  };
};

function statusChip(status?: string) {
  if (status === "failed") return <span className="chip chip-bad">Failed · open to retry</span>;
  if (status === "generating") return <span className="chip chip-warn">Generating…</span>;
  return <span className="chip chip-ok">Ready</span>;
}

export function DashboardClient() {
  const router = useRouter();
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kits").then(async (res) => {
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setKits(data.kits || []);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="card p-8" role="status">
        Loading kits…
      </div>
    );
  }

  if (!kits.length) {
    return (
      <section className="card-raised p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">No kits yet</h1>
        <p className="mt-3 max-w-md text-[var(--ink-soft)]">
          Paste a job description and a company URL to build your first prep plan — questions, flashcards, coverage, and a day-by-day schedule.
        </p>
        <Link className="btn btn-solid mt-6" href="/kits/new">
          Create your first kit
        </Link>
      </section>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {kits.map((doc) => {
        const title = doc.kit?.role?.title || "Interview kit";
        const company = doc.kit?.source?.company || hostnameOf(doc.input?.company_url || "");
        const uncovered = doc.kit?.coverage?.uncovered_requirement_ids?.length ?? 0;
        return (
          <li key={doc._id}>
            <Link className="card flex h-full flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5" href={`/kits/${doc._id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold leading-snug tracking-tight">{title}</p>
                  <p className="mt-1 truncate text-sm text-[var(--ink-soft)]">{company || doc.input?.company_url}</p>
                </div>
                {statusChip(doc.status)}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
                <time dateTime={doc.createdAt}>{new Date(doc.createdAt).toLocaleString()}</time>
                {doc.input?.days ? <span className="chip">{doc.input.days}-day plan</span> : null}
                {doc.status === "ready" && doc.kit?.coverage ? (
                  <span className="chip">{uncovered ? `${uncovered} uncovered` : "Coverage clear"}</span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
