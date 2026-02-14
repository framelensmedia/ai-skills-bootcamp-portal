"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Sparkles, ArrowRight, Zap, Crown, Check } from "lucide-react";

export default function WelcomePage() {
    const router = useRouter();
    const supabase = createSupabaseBrowserClient();
    const [loading, setLoading] = useState(false);
    const [userName, setUserName] = useState<string>("");

    useEffect(() => {
        supabase.auth.getUser().then(({ data }: { data: { user: any } }) => {
            if (!data.user) {
                router.push("/login");
                return;
            }
            // Extract name from email
            const email = data.user.email || "";
            const name = email.split("@")[0];
            setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        });
    }, [supabase, router]);

    const startTrial = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (data?.url) {
                window.location.href = data.url;
                return;
            }
        } catch (e) {
            console.error("Checkout failed:", e);
        }
        setLoading(false);
    };

    const continueWithFree = () => {
        router.push("/onboarding");
    };

    return (
        <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col items-center justify-center px-4">
            <div className="w-full max-w-lg text-center">
                {/* Celebration Header */}
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-lime-400 to-green-500 mb-6 animate-pulse">
                        <Sparkles className="w-10 h-10 text-black" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome{userName ? `, ${userName}` : ""}! 🎉
                    </h1>
                    <p className="text-white/70">
                        Your account is ready. Choose how you want to get started.
                    </p>
                </div>

                {/* Upgrade Card */}
                <div className="rounded-3xl border-2 border-lime-400/50 bg-gradient-to-b from-lime-400/10 to-transparent p-6 mb-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-lime-400 text-black text-xs font-bold px-3 py-1 rounded-bl-xl">
                        RECOMMENDED
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Crown className="w-6 h-6 text-lime-400" />
                        <h2 className="text-xl font-bold text-white">Go Premium</h2>
                    </div>

                    <div className="text-center mb-4">
                        <span className="text-4xl font-bold text-white">$1</span>
                        <span className="text-white/60 text-sm ml-2">for 7 days</span>
                    </div>

                    <ul className="text-left space-y-2 mb-6 text-sm">
                        <li className="flex items-center gap-2 text-white/80">
                            <Check className="w-4 h-4 text-lime-400 flex-shrink-0" />
                            <span>200 credits for AI generations</span>
                        </li>
                        <li className="flex items-center gap-2 text-white/80">
                            <Check className="w-4 h-4 text-lime-400 flex-shrink-0" />
                            <span>Premium templates & prompts</span>
                        </li>
                        <li className="flex items-center gap-2 text-white/80">
                            <Check className="w-4 h-4 text-lime-400 flex-shrink-0" />
                            <span>Full course library access</span>
                        </li>
                        <li className="flex items-center gap-2 text-white/80">
                            <Check className="w-4 h-4 text-lime-400 flex-shrink-0" />
                            <span>Cancel anytime</span>
                        </li>
                    </ul>

                    <button
                        onClick={startTrial}
                        disabled={loading}
                        className="w-full rounded-xl bg-lime-400 px-6 py-4 text-base font-bold text-black hover:bg-lime-300 disabled:opacity-60 transition-all flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            "Redirecting..."
                        ) : (
                            <>
                                <Zap className="w-5 h-5" />
                                Start 7-Day Trial for $1
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <p className="text-xs text-white/40 mt-3">
                        Then $39.99/month. Cancel anytime.
                    </p>
                </div>

                {/* Free Option */}
                <button
                    onClick={continueWithFree}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                    Continue with Free Plan →
                </button>

                <p className="text-xs text-white/40 mt-4">
                    Free plan includes limited prompts and 40 credits.
                </p>
            </div>
        </div>
    );
}
