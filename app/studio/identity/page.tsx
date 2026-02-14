"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import IdentityAnchorUpload from "@/components/identity/IdentityAnchorUpload";
import { Trash2, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

type Identity = {
    id: string;
    name: string | null;
    ref_image_url: string;
    is_active: boolean;
    created_at: string;
};

export default function IdentityStudioPage() {
    const [identities, setIdentities] = useState<Identity[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        fetchIdentities();
    }, []);

    const fetchIdentities = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("user_identities")
                .select("id, name, ref_image_url, is_active, created_at")
                .eq("user_id", user.id)
                .is("deleted_at", null) // Soft delete check
                .order("created_at", { ascending: false });

            if (error) throw error;
            setIdentities(data || []);
        } catch (error) {
            console.error("Error fetching identities:", error);
            toast.error("Failed to load identities.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this identity?")) return;

        try {
            // Soft delete
            const { error } = await supabase
                .from("user_identities")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", id);

            if (error) throw error;

            setIdentities((prev) => prev.filter((i) => i.id !== id));
            toast.success("Identity deleted.");
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete identity.");
        }
    };

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/studio"
                        className="flex items-center justify-center rounded-full bg-white/5 p-3 text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            Identity Studio <Sparkles className="text-[#B7FF00]" size={24} />
                        </h1>
                        <p className="text-white/50">Manage your AI references and digital likenesses.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Create New */}
                <div>
                    <IdentityAnchorUpload onUploadComplete={(newIdentity) => {
                        setIdentities((prev) => [newIdentity, ...prev]);
                    }} />

                    <div className="mt-6 rounded-2xl border border-white/5 bg-zinc-900/30 p-6">
                        <h4 className="flex items-center gap-2 font-bold text-white mb-2">
                            <ShieldCheck className="text-green-400" size={18} />
                            Privacy First
                        </h4>
                        <p className="text-sm text-white/50 leading-relaxed">
                            Your identity anchors are stored securely in your private vault.
                            They are used <strong>only</strong> when you explicitly reference them in a generation.
                        </p>
                    </div>
                </div>

                {/* Right: List */}
                <div className="lg:col-span-2">
                    <h3 className="mb-4 text-xl font-bold text-white/90">Your Identities</h3>

                    {loading ? (
                        <div className="flex h-40 items-center justify-center rounded-2xl border border-white/5 bg-zinc-900/30">
                            <p className="text-white/30">Loading identity vault...</p>
                        </div>
                    ) : identities.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 text-center">
                            <div className="mb-4 rounded-full bg-white/5 p-4 text-white/20">
                                <Sparkles size={32} />
                            </div>
                            <h4 className="text-lg font-medium text-white/80">No Identities Yet</h4>
                            <p className="max-w-xs text-sm text-white/50">
                                Upload a reference photo to start creating consistent characters.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {identities.map((identity) => (
                                <div
                                    key={identity.id}
                                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl transition hover:border-white/20"
                                >
                                    {/* Image */}
                                    <div className="aspect-square relative bg-black">
                                        <Image
                                            src={identity.ref_image_url}
                                            alt={identity.name || "Identity"}
                                            fill
                                            className="object-cover transition duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                    </div>

                                    {/* Info */}
                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                        <h4 className="font-bold text-white text-lg">{identity.name || "Unnamed Identity"}</h4>
                                        <p className="text-xs text-white/50">
                                            Added {new Date(identity.created_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="absolute top-3 right-3 opacity-0 transition group-hover:opacity-100">
                                        <button
                                            onClick={() => handleDelete(identity.id)}
                                            className="rounded-full bg-red-500/20 p-2 text-red-500 hover:bg-red-500 hover:text-white backdrop-blur-md"
                                            title="Delete Identity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
