import { requireUserId } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";
import { db, ObjectId } from "@/lib/db/mongo";
import { validateKit } from "@/lib/validation/kit";

type Context = { params: Promise<{ id: string }> };

function isValidObjectId(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

export async function GET(_request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return json({ error: { message: "Kit not found." } }, 404);
    const doc = await (await db()).collection("kits").findOne({ _id: new ObjectId(id), userId });
    if (!doc) return json({ error: { message: "Kit not found." } }, 404);
    const partial = doc.status === "ready" ? null : {
      role: doc.role || null,
      source: doc.source || null,
      company_brief: doc.company_brief || null,
      questions: doc.questions || null,
      coverage: doc.coverage || null,
      flashcards: doc.flashcards || null,
      schedule: doc.schedule || null,
      research_notes: doc.research_notes || null,
    };
    return json({
      id,
      status: doc.status || "ready",
      progress: doc.progress || [],
      error: doc.error || null,
      kit: doc.kit || null,
      partial: partial && Object.values(partial).some((v) => v !== null) ? partial : null,
      warnings: doc.warnings || doc.research_notes || [],
      input: doc.input,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return json({ error: { message: "Kit not found." } }, 404);
    const { kit } = await request.json();
    const valid = validateKit(kit);
    if (!valid.ok) return json({ error: { message: valid.error } }, 400);
    const result = await (await db()).collection("kits").updateOne({ _id: new ObjectId(id), userId }, { $set: { kit: valid.kit, updatedAt: new Date() } });
    if (!result.matchedCount) return json({ error: { message: "Kit not found." } }, 404);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
