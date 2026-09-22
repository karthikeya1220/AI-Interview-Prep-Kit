import { PracticeClient } from "@/components/PracticeClient";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-8">
      <PracticeClient id={id} />
    </main>
  );
}
