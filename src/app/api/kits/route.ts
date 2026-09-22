import { requireUserId } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";
import { db } from "@/lib/db/mongo";
import { startKitGeneration } from "@/lib/kitGeneration";

export async function GET() {
  try {
    const userId = await requireUserId();
    const kits = await (await db())
      .collection("kits")
      .find(
        { userId },
        {
          projection: {
            status: 1,
            input: 1,
            createdAt: 1,
            error: 1,
            "kit.role.title": 1,
            "kit.source.company": 1,
            "kit.coverage": 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();
    return json({ kits });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = { jd: String(body.jd || ""), company_url: String(body.company_url || ""), days: Number(body.days || 1) };
    if (!input.jd.trim()) return json({ error: { message: "Job description is required." } }, 400);
    const now = new Date();
    const insert = await (await db()).collection("kits").insertOne({
      userId,
      input,
      status: "generating",
      progress: [],
      kit: null,
      warnings: [],
      error: null,
      createdAt: now,
      updatedAt: now,
    });
    // Generation continues server-side even if this request times out or the client disconnects.
    void startKitGeneration(insert.insertedId, userId, input);
    return json({ id: insert.insertedId.toString(), status: "generating" }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
