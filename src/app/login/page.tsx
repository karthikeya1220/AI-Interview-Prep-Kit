import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-6">
      <div className="mx-auto max-w-6xl">
        <AppHeader
          action={
            <Link className="btn btn-sm" href="/register">
              Create account
            </Link>
          }
        />
      </div>
      <AuthForm mode="login" />
      <p className="mt-6 text-center text-sm text-[var(--ink-soft)]">
        No account?{" "}
        <Link className="font-bold underline underline-offset-2" href="/register">
          Register
        </Link>
      </p>
    </main>
  );
}
