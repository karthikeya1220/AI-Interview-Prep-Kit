import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DashboardClient } from "@/components/DashboardClient";
import { LogoutButton } from "@/components/LogoutButton";
import { currentUserId } from "@/lib/auth/session";

export const metadata = {
  title: "Dashboard — Prep Kit",
};

export default async function DashboardPage() {
  let signedIn = false;
  try {
    signedIn = Boolean(await currentUserId());
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <AppHeader
        action={
          <>
            <Link className="btn btn-solid" href="/kits/new">
              New kit
            </Link>
            <LogoutButton />
          </>
        }
      />
      <DashboardClient />
    </main>
  );
}
