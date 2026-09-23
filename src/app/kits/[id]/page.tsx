import { redirect } from "next/navigation";
import { KitClient } from "@/components/KitClient";
import { currentUserId } from "@/lib/auth/session";

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let signedIn = false;
  try {
    signedIn = Boolean(await currentUserId());
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <KitClient id={id} />
    </main>
  );
}
