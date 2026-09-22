import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DashboardClient } from "@/components/DashboardClient";

export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <AppHeader
        action={
          <Link className="btn btn-solid" href="/kits/new">
            New kit
          </Link>
        }
      />
      <DashboardClient />
    </main>
  );
}
