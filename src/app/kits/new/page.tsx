import { AppHeader } from "@/components/AppHeader";
import { NewKitForm } from "@/components/NewKitForm";

export default function NewKitPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <AppHeader />
      <NewKitForm />
    </main>
  );
}
