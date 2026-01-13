import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PromptCard from "@/components/PromptCard";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Layers, Sparkles, Star, Zap, Clock, Share2, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PackDetailPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const supabase = await createSupabaseServerClient();
    const { slug } = await params;

    // Fetch pack details
    const { data: pack } = await supabase
        .from("template_packs")
        .select("*")
        .eq("slug", slug)
        .single();

    if (!pack) {
        notFound();
    }

    // Fetch templates in this pack
    const { data: packTemplates } = await supabase
        .from("prompts")
        .select("id, title, slug, summary, category, access_level, featured_image_url, image_url, media_url, created_at")
        .eq("template_pack_id", pack.id)
        .eq("is_published", true)
        .order("pack_order_index", { ascending: true });

    // Fetch favorites
    const { data: { user } } = await supabase.auth.getUser();
    const favoriteIds = new Set<string>();

    if (user) {
        const { data: favs } = await supabase
            .from("prompt_favorites")
            .select("prompt_id")
            .eq("user_id", user.id);

        (favs || []).forEach((f) => {
            if (f.prompt_id) favoriteIds.add(f.prompt_id);
        });
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#B7FF00]/30 selection:text-[#B7FF00]">

            {/* --- HERO SECTION --- */}
            <div className="relative border-b border-white/5 bg-zinc-950 pb-16 pt-32 lg:pb-24 lg:pt-40">
                {/* Background FX */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    {pack.thumbnail_url && (
                        <div className="absolute inset-0 opacity-20 blur-3xl scale-125 saturate-150">
                            <Image
                                src={pack.thumbnail_url}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/80 to-black" />
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
                </div>

                <div className="relative z-10 mx-auto max-w-7xl px-6">
                    <Link
                        href="/prompts?view=packs"
                        className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                        <ChevronLeft size={12} />
                        Back to Packs
                    </Link>

                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[400px_1fr] lg:items-end">

                        {/* Artwork */}
                        <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50 ring-1 ring-white/10 lg:aspect-[4/5]">
                            {pack.thumbnail_url ? (
                                <Image
                                    src={pack.thumbnail_url}
                                    alt={pack.pack_name}
                                    fill
                                    className="object-cover transition duration-700 ease-out group-hover:scale-105"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-zinc-800">
                                    <Layers className="h-24 w-24 text-white/10" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                            {/* Floating Badge */}
                            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md">
                                    <Sparkles size={12} className="text-[#B7FF00]" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                                        {(packTemplates || []).length} Templates
                                    </span>
                                </div>
                                {pack.access_level === "premium" && (
                                    <div className="flex items-center gap-1 rounded-full bg-[#B7FF00] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow-[0_0_15px_-3px_#B7FF00]">
                                        <Zap size={10} fill="currentColor" /> Pro Only
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="text-5xl font-bold tracking-tight text-white lg:text-7xl">
                                    {pack.pack_name}
                                </h1>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {pack.category && (
                                        <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
                                            {pack.category}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="max-w-2xl text-lg leading-relaxed text-white/60">
                                {pack.pack_description}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-8">
                                <button className="flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-black transition hover:bg-white/90">
                                    Get This Pack
                                </button>
                                <button className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10">
                                    <Share2 size={18} className="text-white/60 transition group-hover:text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CONTENT SECTION --- */}
            <div className="relative mx-auto max-w-7xl px-6 py-24">

                <div className="mb-12 flex items-end justify-between border-b border-white/10 pb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Included Templates</h2>
                        <p className="mt-1 text-sm text-white/50">Everything you get in this collection.</p>
                    </div>
                    <div className="hidden text-xs font-mono text-white/30 sm:block">
                        ID: {pack.id.slice(0, 8)}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {(packTemplates || []).map((p) => {
                        const image = p.featured_image_url || p.image_url || p.media_url || null;
                        return (
                            <PromptCard
                                key={p.id}
                                id={p.id}
                                title={p.title}
                                summary={p.summary || ""}
                                slug={p.slug}
                                featuredImageUrl={image}
                                category={p.category || undefined}
                                accessLevel={p.access_level || undefined}
                                initialFavorited={favoriteIds.has(p.id)}
                            />
                        );
                    })}
                </div>

                {(packTemplates || []).length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-24 text-center">
                        <Layers size={48} className="mb-4 text-white/10" />
                        <h3 className="text-lg font-bold text-white/40">No templates yet</h3>
                        <p className="text-sm text-white/30">This pack is currently empty.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
