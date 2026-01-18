"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canceled = searchParams.get("canceled");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: any } }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  const startCheckout = async () => {
    setError(null);
    setLoading(true);

    try {
      if (!userId) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data?.error || `Checkout error: ${res.status}`);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setError("No checkout URL returned");
    } catch (e: any) {
      setError(e?.message ?? "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-white">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Membership</h1>
        <p className="text-white/70">
          Free prompts and tips, or go Premium for the full vault, resources, and tools.
        </p>
      </div>

      {canceled && (
        <div className="mt-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          Checkout canceled. You can try again anytime.
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Free</h2>
              <p className="mt-1 text-white/70">Get started with the basics.</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold">$0</div>
              <div className="text-sm text-white/60">forever</div>
            </div>
          </div>

          <ul className="mt-6 space-y-3 text-sm text-white/80">
            <li>Free prompt drops (green prompts)</li>
            <li>Quick tips and mini tutorials</li>
            <li>Basic resources</li>
          </ul>

          <button
            onClick={() => router.push(userId ? "/dashboard" : "/login")}
            className="mt-8 w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold hover:bg-black/60"
          >
            {userId ? "Go to Dashboard" : "Log in to Start"}
          </button>
        </div>

        {/* Premium */}
        <div className="rounded-2xl border border-white/15 bg-white/8 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Premium</h2>
              <p className="mt-1 text-white/70">
                Full access to the vault, tools, and member perks.
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-semibold">$39.99</div>
              <div className="text-sm text-white/60">per month</div>
              <div className="text-xs text-[#B7FF00] mt-1 font-medium">7-day trial for $1</div>
            </div>
          </div>

          <ul className="mt-6 space-y-3 text-sm text-white/80">
            <li>Premium prompts and templates</li>
            <li>Members-only vault pages</li>
            <li>Self-paced course access</li>
            <li>Custom GPT resources</li>
          </ul>

          <button
            onClick={startCheckout}
            disabled={loading}
            className="mt-8 w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "Redirecting..." : "Start Trial for $1"}
          </button>

          <p className="mt-3 text-xs text-white/60">
            Secure checkout powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-5xl px-4 py-10 text-white">Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
