import PromptCard from "@/components/PromptCard";
import PromptsToolbar from "@/components/PromptsToolbar";
import PackCarousel from "@/components/PackCarousel";
import RemixCard, { RemixItem } from "@/components/RemixCard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Wand2, Layers, Palette, RefreshCw } from "lucide-react";
import PromptsFooter from "./PromptsFooter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  q?: string;
  category?: string;
  sort?: "newest" | "oldest" | "title_az" | "title_za";
};

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const { q: qParam, category: catParam, sort: sortParam } = await searchParams;

  const q = (qParam ?? "").trim();
  const category = (catParam ?? "all").trim().toLowerCase();

  const hasFilters = q.length > 0 || (category !== "all" && category !== "");
  const defaultSort = hasFilters ? "newest" : "random";
  const sort = (sortParam ?? defaultSort).trim();

  // Fetch published packs with template counts
  const { data: packsData } = await supabase
    .from("template_packs")
    .select("id, pack_name, pack_description, slug, thumbnail_url, category, tags, access_level")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(12);



  // Get template counts for each pack
  const packs = await Promise.all(
    (packsData || [])
      .filter(p => p.slug && p.slug.trim().length > 0) // Filter out missing slugs
      .map(async (pack) => {
        const { count } = await supabase
          .from("prompts")
          .select("id", { count: "exact", head: true })
          .eq("template_pack_id", pack.id);

        return {
          ...pack,
          template_count: count || 0,
        };
      })
  );



  // Build query from SAFE VIEW
  // Added pack_name and pack_slug to select
  let query = supabase
    .from("prompts_public")
    .select(
      "id,title,slug,summary,category,access_level,image_url,featured_image_url,media_url,created_at,pack_name,pack_slug"
    );

  if (q) {
    // Basic search: title OR summary OR category
    query = query.or(
      `title.ilike.%${q}%,summary.ilike.%${q}%,category.ilike.%${q}%`
    );
  }

  if (category && category !== "all") {
    query = query.ilike("category", category);
  }

  // Sorting
  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (sort === "title_az") query = query.order("title", { ascending: true });
  else if (sort === "title_za") query = query.order("title", { ascending: false });
  else if (sort === "newest") query = query.order("created_at", { ascending: false });

  const { data: rawPrompts, error } = await query;

  let prompts = rawPrompts || [];
  if (sort === "random") {
    // Shuffle prompts in memory
    for (let i = prompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prompts[i], prompts[j]] = [prompts[j], prompts[i]];
    }
  }

  // Fetch Trending Templates (Top 6)
  const { data: trendingPrompts } = await supabase
    .from("prompts_public")
    .select(
      "id,title,slug,summary,category,access_level,image_url,featured_image_url,media_url,created_at,pack_name,pack_slug"
    )
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
          <div className="text-lg font-semibold text-red-200">
            Failed to load prompts
          </div>
          <div className="mt-2 text-sm text-red-200/80">{error.message}</div>
        </div>
      </main>
    );
  }

  // Categories for toolbar
  const categories = Array.from(
    new Set((prompts ?? []).map((p) => (p.category ?? "general").toLowerCase()))
  ).sort();

  // Fetch favorites if user is logged in
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-14 text-white">
      {/* Header - Styled like Home Remix Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B7FF00]/10 text-[#B7FF00]">
              <Layers size={12} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#B7FF00]">
              Premium Collections
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3">
            Free Templates
          </h1>
          <p className="text-xl text-white/60 max-w-2xl">
            Curated collections of high-performance prompts. One click to remix and make them yours.
          </p>
        </div>
      </div>

      {/* Section 1: Latest Prompts */}
      <div className="mt-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Wand2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Latest Templates</h2>
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 shadow-sm cursor-default">
              <span className="text-purple-400 flex-shrink-0">●</span>
              <span className="text-xs font-medium text-white">Newest additions to our library</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(trendingPrompts ?? []).map((p) => {
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
                packName={p.pack_name || undefined}
                packSlug={p.pack_slug || undefined}
                initialFavorited={favoriteIds.has(p.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Section 2: Pack Carousel */}
      <div className="mt-16 pt-8 border-t border-white/10">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B7FF00]/10 border border-[#B7FF00]/20 text-[#B7FF00]">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Prompt Packs</h2>
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 shadow-sm cursor-default">
              <span className="text-[#B7FF00] flex-shrink-0">●</span>
              <span className="text-xs font-medium text-white">Curated collections for specific workflows</span>
            </div>
          </div>
        </div>
        <PackCarousel packs={packs} />
      </div>

      {/* Section 3: All Templates (Toolbar + Grid) */}
      <div className="mt-16 pt-8 border-t border-white/10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Palette size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">All Templates</h2>
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 shadow-sm cursor-default">
                <span className="text-blue-400 flex-shrink-0">●</span>
                <span className="text-xs font-medium text-white">Search and filter our entire library</span>
              </div>
            </div>
          </div>
        </div>

        <PromptsToolbar
          initialQuery={q}
          initialCategory={category}
          initialSort={sort}
          categories={categories}
        />


        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(prompts ?? []).map((p) => {
            const image =
              p.featured_image_url || p.image_url || p.media_url || null;

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
                packName={p.pack_name || undefined}
                packSlug={p.pack_slug || undefined}
                initialFavorited={favoriteIds.has(p.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Client-Side Footer: Trending Prompts & Infinite Infinite Remixes */}
      <PromptsFooter />
    </div>

  );
}
