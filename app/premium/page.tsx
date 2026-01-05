"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function PremiumPage() {
  const router = useRouter();

  // ✅ define supabase (this is what was missing)
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const user = data?.user;

        if (!user) {
          router.push("/login?redirectTo=/premium");
          return;
        }

        // If you want to enforce “premium-only”, uncomment this block:
        /*
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const plan = String(profile?.plan || "free").toLowerCase();
        if (plan !== "premium") {
          router.push("/pricing");
          return;
        }
        */

        if (!cancelled) setLoading(false);
      } catch {
        router.push("/login?redirectTo=/premium");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-lg font-semibold">Loading…</div>
          <div className="mt-2 text-sm text-white/60">Checking access.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
        <h1 className="text-2xl font-semibold">Premium</h1>
        <p className="mt-2 text-white/70">You are signed in.</p>
      </div>
    </main>
  );
}
