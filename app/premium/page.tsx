"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";


export default function PremiumPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user.id)
        .single();

      if (error) console.error(error);

      setPlan(profile?.plan ?? "free");
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (plan !== "premium") {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
          <h1 className="text-2xl font-semibold">Premium Vault</h1>
          <p className="mt-3 text-sm text-white/70">
            This area is for Premium members. Upgrade to unlock the vault,
            courses, and community.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              Upgrade for $29/mo
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
        <h1 className="text-2xl font-semibold">Premium Vault</h1>
        <p className="mt-3 text-sm text-white/70">
          You’re Premium. Welcome to the vault.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-semibold">Prompt Packs</p>
          <p className="mt-1 text-sm text-white/70">Downloadable swipe files.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-semibold">Course Access</p>
          <p className="mt-1 text-sm text-white/70">Self-paced modules.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-semibold">Community</p>
          <p className="mt-1 text-sm text-white/70">Private member area.</p>
        </div>
      </div>
    </div>
  );
}
