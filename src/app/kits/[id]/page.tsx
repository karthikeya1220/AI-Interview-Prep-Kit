import { KitClient } from "@/components/KitClient";

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <KitClient id={id} />
    </main>
  );
}
