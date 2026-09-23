import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NewKitForm } from "@/components/NewKitForm";
import { currentUserId } from "@/lib/auth/session";

export const metadata = {
  title: "Create kit — Prep Kit",
};

export default async function NewKitPage() {
  let signedIn = false;
  try {
    signedIn = Boolean(await currentUserId());
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <AppHeader />
      <NewKitForm />
    </main>
  );
}
