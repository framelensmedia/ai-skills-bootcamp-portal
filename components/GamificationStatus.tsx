"use client";

import { useAuth } from "@/context/AuthProvider";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Flame, Zap } from "lucide-react";
import { useEffect, useState } from "react";

export default function GamificationStatus() {
    const { user } = useAuth();
    const [stats, setStats] = useState<{ xp: number; streak: number } | null>(null);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        if (!user) return;

        async function fetchStats() {
            const { data } = await supabase
                .from("profiles")
                .select("xp, streak_days")
                .eq("id", user?.id)
                .single();

            if (data) {
                setStats({
                    xp: data.xp || 0,
                    streak: data.streak_days || 0
                });
            }
        }

        fetchStats();

        // Subscribe to changes
        const channel = supabase
            .channel('gamification_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    setStats({
                        xp: payload.new.xp || 0,
                        streak: payload.new.streak_days || 0
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    if (!stats) return null;

    return (
        <div className="flex items-center gap-3 mr-4">
            <div className="flex items-center gap-1 text-amber-500" title="Daily Streak">
                <Flame size={16} fill="currentColor" className={stats.streak > 0 ? "animate-pulse" : "opacity-50"} />
                <span className="text-sm font-bold">{stats.streak}</span>
            </div>
            <div className="flex items-center gap-1 text-[#B7FF00]" title="Total XP">
                <Zap size={16} fill="currentColor" />
                <span className="text-sm font-bold">{stats.xp}</span>
            </div>
        </div>
    );
}
