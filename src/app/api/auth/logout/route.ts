import { clearUserSession } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";

export async function POST() {
  try {
    await clearUserSession();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
