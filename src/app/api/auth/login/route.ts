import { createUserSession, verifyPassword } from "@/lib/auth/session";
import { db } from "@/lib/db/mongo";
import { errorResponse, json } from "@/lib/api/respond";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await (await db()).collection("users").findOne({ email: String(email || "").trim().toLowerCase() });
    if (!user || !(await verifyPassword(String(password || ""), user.passwordHash))) return json({ error: { message: "Invalid email or password." } }, 401);
    await createUserSession(user._id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
