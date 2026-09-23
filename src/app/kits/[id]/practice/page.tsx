import { redirect } from "next/navigation";
import { PracticeClient } from "@/components/PracticeClient";
import { currentUserId } from "@/lib/auth/session";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let signedIn = false;
  try {
    signedIn = Boolean(await currentUserId());
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-8">
      <PracticeClient id={id} />
    </main>
  );
}
