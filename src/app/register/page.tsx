import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
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
    </main>
  );
}
