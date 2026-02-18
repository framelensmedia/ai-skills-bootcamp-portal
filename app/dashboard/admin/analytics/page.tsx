import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Users, CreditCard, Award, UserCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { stripe } from "@/lib/stripe-server";

// Revalidate every 60 seconds to avoid hitting rate limits too hard but keep data fresh
export const revalidate = 60;

export default async function AdminAnalyticsPage() {
    const supabase = await createSupabaseServerClient();

    // 1. Total Registered Users (Supabase)
    const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

    // 2. Stripe Stats (Source of truth for billing)
    // We use the LIST API for immediate consistency (search is eventually consistent)

    let activePaidUsers = 0;
    try {
        // Check for 'active' status
        const listActive = await stripe.subscriptions.list({
            status: 'active',
            limit: 100, // Fetch up to 100 recent to count (paginate if scaling needed)
        });
        // For now, just length. If > 100, we'd need pagination loop, but for startup scale this is fine.
        activePaidUsers = listActive.data.length;
        if (listActive.has_more) {
            // Simple indicator it's 100+
            activePaidUsers = 100;
        }
    } catch (e) {
        console.error("Stripe list failed (Active):", e);
    }

    let trialingUsers = 0;
    try {
        const listTrialing = await stripe.subscriptions.list({
            status: 'trialing',
            limit: 100,
        });
        trialingUsers = listTrialing.data.length;
    } catch (e) {
        console.error("Stripe list failed (Trialing):", e);
    }

    // 4. Active Ambassadors
    const { count: activeAmbassadors } = await supabase
        .from("ambassadors")
        .select("*", { count: "exact", head: true });


    return (
        <div className="mx-auto max-w-7xl px-4 py-8 text-white font-sans">
            <div className="mb-8 flex items-center gap-4">
                <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition">
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </Link>
            </div>

            <div className="mb-8 border-b border-white/10 pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                    Admin Analytics
                </h1>
                <p className="mt-2 text-white/60">Overview of user base and growth metrics (Source: Stripe & DB).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Users */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                            <Users size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white/80">Total Users</h3>
                    </div>
                    <p className="text-4xl font-bold text-white">{totalUsers || 0}</p>
                    <p className="text-sm text-white/40 mt-1">Registered accounts</p>
                </div>

                {/* Active Paid Users */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#B7FF00]/10 text-[#B7FF00]">
                            <CreditCard size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white/80">Active Paid</h3>
                    </div>
                    <p className="text-4xl font-bold text-white">{activePaidUsers}</p>
                    <p className="text-sm text-white/40 mt-1">Stripe Active Subs</p>
                </div>

                {/* Trialing Users */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                            <Award size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white/80">On Trial</h3>
                    </div>
                    <p className="text-4xl font-bold text-white">{trialingUsers}</p>
                    <p className="text-sm text-white/40 mt-1">Stripe Trialing Subs</p>
                </div>

                {/* Active Ambassadors */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                            <UserCheck size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white/80">Ambassadors</h3>
                    </div>
                    <p className="text-4xl font-bold text-white">{activeAmbassadors || 0}</p>
                    <p className="text-sm text-white/40 mt-1">Registered partners</p>
                </div>
            </div>
        </div>
    );
}
