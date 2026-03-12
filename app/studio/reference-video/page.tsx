"use client";

import { Suspense, useState, useEffect } from "react";
import { Wand2 } from "lucide-react";
import ReferenceVideoTab from "../creator/_components/ReferenceVideoTab";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ReferenceVideoPage() {
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: any } }) => {
            if (!user) return;
            const { data: profile } = await supabase
                .from("profiles")
                .select("credits, role")
                .eq("user_id", user.id)
                .maybeSingle();
            if (profile) {
                setUserCredits(profile.credits ?? 0);
                const r = String(profile.role || "").toLowerCase();
                setIsAdmin(r === "admin" || r === "super_admin");
            }
        });
    }, []);

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white">
            {/* Page Header */}
            <div className="mb-8 flex flex-col md:flex-row gap-4 md:items-end md:justify-between border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3 mb-1">
                        <Wand2 className="w-8 h-8 text-violet-400" />
                        Magic Video
                    </h1>
                    <p className="text-sm text-white/50">Generate a video guided by reference images</p>
                </div>
                {userCredits !== null && (
                    <div className="text-xs font-semibold text-white/40 border border-white/10 rounded-lg px-4 py-2">
                        {isAdmin ? "∞ credits (Admin)" : `${userCredits} credits remaining`}
                    </div>
                )}
            </div>

            <Suspense>
                <ReferenceVideoTab
                    userCredits={userCredits}
                    isAdmin={isAdmin}
                    onCreditsUsed={(amount) => setUserCredits((prev) => (prev ?? 0) - amount)}
                />
            </Suspense>
        </main>
    );
}
