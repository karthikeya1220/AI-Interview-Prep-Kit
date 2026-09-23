import Link from "next/link";

export function AppHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--line)] pb-4">
      <Link className="text-lg font-extrabold tracking-tight" href="/">
        Prep Kit
      </Link>
      <div className="flex items-center gap-3">{action}</div>
    </header>
  );
}
