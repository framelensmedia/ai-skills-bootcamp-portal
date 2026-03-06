import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Users, CreditCard, Award, UserCheck, ArrowLeft, Image as ImageIcon, Film, FolderOpen, Globe, Coins, BadgeCent } from "lucide-react";
import Link from "next/link";
import { stripe } from "@/lib/stripe-server";

// Revalidate every 60 seconds to avoid hitting rate limits too hard but keep data fresh
export const revalidate = 60;

export default async function AdminAnalyticsPage() {
    const supabase = await createSupabaseServerClient();

    // Verify Super Admin status before rendering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return <div className="p-8 text-white">Unauthorized.</div>;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (profile?.role !== 'super_admin') {
        return <div className="p-8 text-white">Access Denied. Super Admin only.</div>;
    }

    // ==========================================
    // 1. User & Revenue Metrics
    // ==========================================
    const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });

    let activePaidUsers = 0;
    try {
        const listActive = await stripe.subscriptions.list({ status: 'active', limit: 100 });
        activePaidUsers = listActive.data.length;
        if (listActive.has_more) activePaidUsers = 100;
    } catch (e) {
        console.error("Stripe list failed (Active):", e);
    }

    let trialingUsers = 0;
    try {
        const listTrialing = await stripe.subscriptions.list({ status: 'trialing', limit: 100 });
        trialingUsers = listTrialing.data.length;
    } catch (e) {
        console.error("Stripe list failed (Trialing):", e);
    }

    const { count: activeAmbassadors } = await supabase.from("ambassadors").select("*", { count: "exact", head: true });


    // ==========================================
    // 2. Generation Engine Metrics
    // ==========================================
    const { count: totalImages } = await supabase.from("prompt_generations").select("*", { count: "exact", head: true });
    const { count: totalVideos } = await supabase.from("video_generations").select("*", { count: "exact", head: true });
    const { count: publicRemixes } = await supabase.from("prompt_generations").select("*", { count: "exact", head: true }).eq("is_public", true);
    const { count: totalFolders } = await supabase.from("folders").select("*", { count: "exact", head: true });


    // ==========================================
    // 3. Platform Economy Metrics
    // ==========================================
    // We sum up the credits of all users to see the total "outstanding" liability
    let totalCreditsInCirculation = 0;
    let averageCredits = 0;

    const { data: allProfiles } = await supabase.from("profiles").select("credits");
    if (allProfiles && allProfiles.length > 0) {
        totalCreditsInCirculation = allProfiles.reduce((sum, profile) => sum + (profile.credits || 0), 0);
        averageCredits = Math.round(totalCreditsInCirculation / allProfiles.length);
    }


    return (
        <div className="mx-auto max-w-7xl px-4 py-8 text-white font-sans space-y-12">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition group">
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Mission Control
                    </Link>
                </div>
            </div>

            <div className="border-b border-white/10 pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl flex items-center gap-4">
                    System Analytics
                    <span className="text-xs bg-lime-400 text-black px-2 py-1 flex items-center gap-1 rounded uppercase tracking-widest font-bold align-middle">
                        <span className="w-2 h-2 rounded-full bg-black animate-pulse"></span> Live
                    </span>
                </h1>
                <p className="mt-4 text-white/50 text-lg">Real-time telemetry for users, revenue, generation engines, and platform economy.</p>
            </div>

            {/* --- SECTION 1: USER BASE & REVENUE --- */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Users size={16} /> User Base & Subscriptions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Users size={80} /></div>
                        <h3 className="text-sm font-bold text-white/60 mb-1">Total Registered Users</h3>
                        <p className="text-4xl font-black text-white">{totalUsers?.toLocaleString() || 0}</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard size={80} /></div>
                        <h3 className="text-sm font-bold text-lime-400 mb-1">Active Paid (Stripe)</h3>
                        <p className="text-4xl font-black text-white">{activePaidUsers}</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Award size={80} /></div>
                        <h3 className="text-sm font-bold text-orange-400 mb-1">On Trial (Stripe)</h3>
                        <p className="text-4xl font-black text-white">{trialingUsers}</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><UserCheck size={80} /></div>
                        <h3 className="text-sm font-bold text-purple-400 mb-1">Active Ambassadors</h3>
                        <p className="text-4xl font-black text-white">{activeAmbassadors?.toLocaleString() || 0}</p>
                    </div>
                </div>
            </section>


            {/* --- SECTION 2: GENERATION ENGINE --- */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Film size={16} /> Content Generation Engine
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><ImageIcon size={80} /></div>
                        <h3 className="text-sm font-bold text-white/60 mb-1">Total Images Generated</h3>
                        <p className="text-4xl font-black text-white">{totalImages?.toLocaleString() || 0}</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Film size={80} /></div>
                        <h3 className="text-sm font-bold text-indigo-400 mb-1">Total Videos Generated</h3>
                        <p className="text-4xl font-black text-white">{totalVideos?.toLocaleString() || 0}</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Globe size={80} /></div>
                        <h3 className="text-sm font-bold text-green-400 mb-1">Public Remixes</h3>
                        <p className="text-4xl font-black text-white">{publicRemixes?.toLocaleString() || 0}</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><FolderOpen size={80} /></div>
                        <h3 className="text-sm font-bold text-amber-400 mb-1">Total Folders Created</h3>
                        <p className="text-4xl font-black text-white">{totalFolders?.toLocaleString() || 0}</p>
                    </div>
                </div>
            </section>


            {/* --- SECTION 3: PLATFORM ECONOMY --- */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Coins size={16} /> Platform Economy
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[#B7FF00]/20 bg-[#B7FF00]/5 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 p-4 opacity-10 text-[#B7FF00]"><Coins size={200} /></div>
                        <h3 className="text-sm font-bold text-[#B7FF00] mb-2 uppercase tracking-wide">Total Credits in Circulation</h3>
                        <p className="text-6xl font-black text-white drop-shadow-lg">{totalCreditsInCirculation.toLocaleString()}</p>
                        <p className="mt-2 text-sm text-white/40">The aggregate sum of credits currently sitting in all user wallets.</p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><BadgeCent size={80} /></div>
                        <h3 className="text-sm font-bold text-white/60 mb-1">Average Credits Per User</h3>
                        <p className="text-4xl font-black text-white">{averageCredits.toLocaleString()}</p>
                        <p className="mt-1 text-sm text-white/40">Mean wallet balance across the userbase.</p>
                    </div>
                </div>
            </section>

        </div>
    );
}
