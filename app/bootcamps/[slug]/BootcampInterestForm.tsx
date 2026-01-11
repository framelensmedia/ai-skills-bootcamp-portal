"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { Loader2, Check } from "lucide-react";

export default function BootcampInterestForm({ bootcampId, slug }: { bootcampId: string; slug: string }) {
    const { user } = useAuth();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload = {
                slug,
                bootcampId,
                email: user ? user.email : email,
                userId: user?.id
            };

            // TODO: Replace with actual Server Action or API call
            // For MVP, we simulate a successful webhook trigger
            console.log("Triggering interest webhook:", payload);

            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate net delay

            setSuccess(true);
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-4 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-12 w-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-3">
                    <Check size={24} strokeWidth={3} />
                </div>
                <h4 className="text-lg font-bold text-white">You're on the list!</h4>
                <p className="text-sm text-white/50">We'll notify you when this bootcamp launches.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!user && (
                <div>
                    <label htmlFor="email" className="sr-only">Email address</label>
                    <input
                        type="email"
                        id="email"
                        required
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none focus:ring-1 focus:ring-[#B7FF00] transition"
                    />
                </div>
            )}

            <button
                type="submit"
                disabled={loading || (!user && !email)}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#B7FF00] px-6 py-3 font-bold text-black transition hover:bg-[#a3e600] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 size={20} className="animate-spin" /> : "Get Notified"}
            </button>

            {user && (
                <p className="text-xs text-center text-white/30">
                    Joining as <span className="text-white/60">{user.email}</span>
                </p>
            )}

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        </form>
    );
}
