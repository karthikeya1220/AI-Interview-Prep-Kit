import { requireUserId } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";
import { db, ObjectId } from "@/lib/db/mongo";

type Context = { params: Promise<{ id: string }> };

function isValidObjectId(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

export async function GET(_request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return json({ error: { message: "Kit not found." } }, 404);
    const records = await (await db()).collection("practice").find({ userId, kitId: new ObjectId(id) }).toArray();
    return json({ records });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return json({ error: { message: "Kit not found." } }, 404);
    const { flashcardId, confidence } = await request.json();
    if (!flashcardId || typeof flashcardId !== "string") return json({ error: { message: "flashcardId is required." } }, 400);
    await (await db()).collection("practice").updateOne(
      { userId, kitId: new ObjectId(id), flashcardId },
      { $set: { confidence: Math.max(1, Math.min(5, Number(confidence || 1))), lastSeenAt: new Date() } },
      { upsert: true },
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
