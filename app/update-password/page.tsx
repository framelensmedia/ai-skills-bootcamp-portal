"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";

export default function UpdatePasswordPage() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    async function handleUpdatePassword(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.updateUser({
            password: password,
        });

        if (error) {
            setMessage({ type: "error", text: error.message });
            setLoading(false);
        } else {
            setMessage({ type: "success", text: "Password updated successfully!" });
            setLoading(false);

            // Redirect after a short delay
            setTimeout(() => {
                router.push("/feed");
            }, 2000);
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col items-center justify-center py-10 text-white">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-6">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-lime-400/10 text-lime-400">
                    <Lock size={24} />
                </div>

                <h1 className="text-2xl font-semibold">Set New Password</h1>
                <p className="mt-2 text-sm text-white/70">
                    Please enter your new password below.
                </p>

                {message && (
                    <div className={`mt-6 rounded-2xl border p-4 text-sm flex items-center gap-3 ${message.type === "success"
                            ? "border-lime-500/30 bg-lime-950/30 text-lime-200"
                            : "border-red-500/30 bg-red-950/30 text-red-200"
                        }`}>
                        {message.type === "success" && <CheckCircle size={18} />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
                    <div>
                        <label className="text-sm text-white/70">New Password</label>
                        <div className="relative">
                            <input
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25 pr-10"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-[calc(50%+4px)] -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || (message?.type === "success")}
                        className="w-full rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-60 transition-all"
                    >
                        {loading ? "Updating..." : "Update Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
