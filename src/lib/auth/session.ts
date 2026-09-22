import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, ObjectId } from "@/lib/db/mongo";

const cookieName = "session";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: ObjectId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await (await db()).collection("sessions").insertOne({ userId, tokenHash: hashToken(token), expiresAt });
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function clearUserSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await (await db()).collection("sessions").deleteOne({ tokenHash: hashToken(token) });
  jar.delete(cookieName);
}

export async function currentUserId() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  const session = await (await db()).collection("sessions").findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  return session?.userId as ObjectId | null;
}

export async function requireUserId() {
  const userId = await currentUserId();
  if (!userId) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return userId;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
