"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type RechargeModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function RechargeModal({ isOpen, onClose }: RechargeModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [buyingPack, setBuyingPack] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getUser().then(({ data }: { data: { user: any } }) => {
            setUserId(data.user?.id ?? null);
        });
    }, [isOpen]);

    const buyCredits = async (packId: string) => {
        setError(null);
        setBuyingPack(packId);

        try {
            if (!userId) {
                // Should not happen for authenticated users in Studio
                router.push("/login?redirect=/studio");
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" role="dialog">
            <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 shadow-2xl md:p-8">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
                >
                    ✕
                </button>

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Recharge Credits ⚡</h2>
                    <p className="text-white/60">Top up your balance instantly.</p>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 text-center">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* 50 Credits */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition-colors text-center">
                        <div className="text-3xl mb-2">⚡</div>
                        <div className="text-xl font-bold text-white mb-1">$4.99</div>
                        <div className="text-sm font-semibold text-white/80 mb-4">50 Credits</div>
                        <button
                            onClick={() => buyCredits("credits_50")}
                            disabled={buyingPack !== null}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                        >
                            {buyingPack === "credits_50" ? "..." : "Buy Now"}
                        </button>
                    </div>

                    {/* 120 Credits - Popular */}
                    <div className="rounded-xl border border-[#B7FF00]/40 bg-[#B7FF00]/10 p-4 relative text-center transform scale-105 shadow-lg shadow-[#B7FF00]/10">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#B7FF00] text-black text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            BEST VALUE
                        </div>
                        <div className="text-3xl mb-2">🔥</div>
                        <div className="text-xl font-bold text-white mb-1">$9.99</div>
                        <div className="text-sm font-semibold text-white/80 mb-4">120 Credits</div>
                        <button
                            onClick={() => buyCredits("credits_120")}
                            disabled={buyingPack !== null}
                            className="w-full rounded-lg bg-[#B7FF00] px-3 py-2 text-sm font-bold text-black hover:bg-[#a8e600] disabled:opacity-50 transition-colors"
                        >
                            {buyingPack === "credits_120" ? "..." : "Buy Now"}
                        </button>
                    </div>

                    {/* 300 Credits */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition-colors text-center">
                        <div className="text-3xl mb-2">💎</div>
                        <div className="text-xl font-bold text-white mb-1">$19.99</div>
                        <div className="text-sm font-semibold text-white/80 mb-4">300 Credits</div>
                        <button
                            onClick={() => buyCredits("credits_300")}
                            disabled={buyingPack !== null}
                            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                        >
                            {buyingPack === "credits_300" ? "..." : "Buy Now"}
                        </button>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-xs text-white/40">
                        Secure checkout via Stripe. Credits never expire.
                    </p>
                </div>
            </div>
        </div>
    );
}
