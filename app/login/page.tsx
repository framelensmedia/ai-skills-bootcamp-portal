"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setLoading(false);
    setError(error.message);
    return;
  }

  // ✅ Force session to be loaded and cookies to be written before redirect
  await supabase.auth.getSession();

  // Small delay to allow cookie write to complete in the browser
  await new Promise((r) => setTimeout(r, 200));

  setLoading(false);

  // Use replace to prevent back-button weirdness
  router.replace("/dashboard");
  router.refresh();
}


  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-950 p-6 space-y-4"
      >
        <h1 className="text-2xl font-bold">Login</h1>

        {error && (
          <div className="rounded bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md bg-black border border-white/10 px-3 py-2 outline-none focus:border-white/30"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md bg-black border border-white/10 px-3 py-2 outline-none focus:border-white/30"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-white text-black py-2 font-semibold hover:bg-zinc-200 transition disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
