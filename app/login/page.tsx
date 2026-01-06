"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function LoginContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const redirectTo = sp?.get("redirectTo") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // ✅ Redirect back to the prompt (or wherever), fallback to dashboard
    router.push(redirectTo || "/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 text-white">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="mt-2 text-sm text-white/70">
          {redirectTo
            ? "Log in to continue where you left off."
            : "Log in to your account."}
        </p>

        {errorMsg ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/signup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`)}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm font-semibold text-white hover:bg-black/50"
          >
            Create an account
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-10 text-white">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
