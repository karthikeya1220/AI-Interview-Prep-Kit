import { db } from "@/lib/db/mongo";
import { createUserSession, hashPassword } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized.includes("@") || String(password || "").length < 8) return json({ error: { message: "Use a valid email and 8+ character password." } }, 400);
    const database = await db();
    if (await database.collection("users").findOne({ email: normalized })) return json({ error: { message: "Email already registered." } }, 409);
    const result = await database.collection("users").insertOne({ email: normalized, passwordHash: await hashPassword(password), createdAt: new Date() });
    await createUserSession(result.insertedId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
