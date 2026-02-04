"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    async function handleReset(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password`,
        });

        if (error) {
            setMessage({ type: "error", text: error.message });
            setLoading(false);
        } else {
            setMessage({
                type: "success",
                text: "Check your email for the password reset link.",
            });
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col items-center justify-center py-10 text-white">
            <div className="w-full max-w-md space-y-6">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Login
                </Link>

                <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-lime-400/10 text-lime-400">
                        <Mail size={24} />
                    </div>

                    <h1 className="text-2xl font-semibold">Reset Password</h1>
                    <p className="mt-2 text-sm text-white/70">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>

                    {message && (
                        <div className={`mt-6 rounded-2xl border p-4 text-sm ${message.type === "success"
                                ? "border-lime-500/30 bg-lime-950/30 text-lime-200"
                                : "border-red-500/30 bg-red-950/30 text-red-200"
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleReset} className="mt-6 space-y-4">
                        <div>
                            <label className="text-sm text-white/70">Email address</label>
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                type="email"
                                autoComplete="email"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
                                placeholder="you@example.com"
                                required
                                disabled={loading || (message?.type === "success")}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || (message?.type === "success")}
                            className="w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-60 transition-all"
                        >
                            {loading ? "Sending link..." : "Send Reset Link"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
