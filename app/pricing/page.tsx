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
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const canceled = searchParams.get("canceled");

  const buyCredits = async (packId: string) => {
    setError(null);
    setBuyingPack(packId);

    try {
      if (!userId) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
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
      setBuyingPack(null);
    }
  };

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
    <div className="mx-auto w-full max-w-5xl px-4 py-10 pb-40 text-white">
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

      {/* Credit Packs Section */}
      <div className="mt-16">
        <div className="flex flex-col gap-2 mb-8">
          <h2 className="text-2xl font-semibold">Credit Packs</h2>
          <p className="text-white/70">
            Need more credits? Top up your account instantly with a one-time purchase.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 50 Credits */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="text-4xl">⚡</div>
              <div className="text-right">
                <div className="text-2xl font-bold">$4.99</div>
                <div className="text-xs text-white/50">~10¢ each</div>
              </div>
            </div>
            <div className="text-xl font-semibold mb-1">50 Credits</div>
            <p className="text-sm text-white/60 mb-6">Perfect for trying things out</p>
            <button
              onClick={() => buyCredits("credits_50")}
              disabled={buyingPack !== null}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20 disabled:opacity-60 transition-colors"
            >
              {buyingPack === "credits_50" ? "Redirecting..." : "Buy Now"}
            </button>
          </div>

          {/* 120 Credits - Popular */}
          <div className="rounded-2xl border-2 border-[#B7FF00]/50 bg-[#B7FF00]/5 p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#B7FF00] text-black text-xs font-bold px-3 py-1 rounded-full">
              BEST VALUE
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-4xl">🔥</div>
              <div className="text-right">
                <div className="text-2xl font-bold">$9.99</div>
                <div className="text-xs text-[#B7FF00]">~8¢ each</div>
              </div>
            </div>
            <div className="text-xl font-semibold mb-1">120 Credits</div>
            <p className="text-sm text-white/60 mb-6">Most popular choice</p>
            <button
              onClick={() => buyCredits("credits_120")}
              disabled={buyingPack !== null}
              className="w-full rounded-lg bg-[#B7FF00] px-4 py-3 text-sm font-bold text-black hover:bg-[#a8e600] disabled:opacity-60 transition-colors"
            >
              {buyingPack === "credits_120" ? "Redirecting..." : "Buy Now"}
            </button>
          </div>

          {/* 300 Credits */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="text-4xl">💎</div>
              <div className="text-right">
                <div className="text-2xl font-bold">$19.99</div>
                <div className="text-xs text-white/50">~7¢ each</div>
              </div>
            </div>
            <div className="text-xl font-semibold mb-1">300 Credits</div>
            <p className="text-sm text-white/60 mb-6">For power creators</p>
            <button
              onClick={() => buyCredits("credits_300")}
              disabled={buyingPack !== null}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20 disabled:opacity-60 transition-colors"
            >
              {buyingPack === "credits_300" ? "Redirecting..." : "Buy Now"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          Credits never expire. One-time purchase, instant delivery.
        </p>
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
