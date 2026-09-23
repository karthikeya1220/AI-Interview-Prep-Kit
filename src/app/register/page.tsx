import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";
import { currentUserId } from "@/lib/auth/session";

export const metadata = {
  title: "Create account — Prep Kit",
};

export default async function RegisterPage() {
  let signedIn = false;
  try {
    signedIn = Boolean(await currentUserId());
  } catch {
    /* show register form */
  }
  if (signedIn) redirect("/dashboard");

  return (
    <main className="min-h-screen px-6">
      <div className="mx-auto max-w-6xl">
        <AppHeader
          action={
            <Link className="btn btn-sm" href="/login">
              Log in
            </Link>
          }
        />
      </div>
      <AuthForm mode="register" />
      <p className="mt-6 text-center text-sm text-[var(--ink-soft)]">
        Already registered?{" "}
        <Link className="font-bold underline underline-offset-2" href="/login">
          Log in
        </Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link className="page-back" href="/">
          Back to home
        </Link>
      </p>
    </main>
  );
}
