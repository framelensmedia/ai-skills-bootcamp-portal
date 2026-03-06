import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { ArrowLeft, Power } from "lucide-react";
import Link from "next/link";
import ModelManager from "./_components/ModelManager";

export const revalidate = 0; // Don't cache admin controls

export default async function SystemControlsPage() {
    const supabase = await createSupabaseServerClient();

    // Verify Super Admin status before rendering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return <div className="p-8 text-white">Unauthorized.</div>;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== 'super_admin') {
        return <div className="p-8 text-white">Access Denied. Super Admin only.</div>;
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 text-white font-sans space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Mission Control
                </Link>
            </div>

            <div className="border-b border-red-500/30 pb-6 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl flex items-center gap-4">
                    <Power className="text-red-500" size={40} />
                    System Controls
                </h1>
                <p className="mt-4 text-white/50 text-lg">Emergency overrides and core engine availability configurations.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ModelManager />
            </div>
        </div>
    );
}
