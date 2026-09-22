import { requireUserId } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";
import { db, ObjectId } from "@/lib/db/mongo";
import { startKitGeneration } from "@/lib/kitGeneration";

type Context = { params: Promise<{ id: string }> };

/** Re-run generation for a failed kit in place, preserving partial results until each step overwrites them. */
export async function POST(_request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return json({ error: { message: "Kit not found." } }, 404);
    const collection = (await db()).collection("kits");
    const doc = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!doc) return json({ error: { message: "Kit not found." } }, 404);
    if (doc.status === "generating") return json({ status: "generating" });
    if (doc.status === "ready") return json({ status: "ready" });
    await collection.updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { status: "generating", error: null, progress: [], updatedAt: new Date() } },
    );
    void startKitGeneration(new ObjectId(id), userId, doc.input);
    return json({ status: "generating" }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
