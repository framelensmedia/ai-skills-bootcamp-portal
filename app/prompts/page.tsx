import PromptCard from "@/components/PromptCard";
import PromptsToolbar from "@/components/PromptsToolbar";
import PackCarousel from "@/components/PackCarousel";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Wand2, Layers, Palette } from "lucide-react";

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
  const sort = (sortParam ?? "newest").trim();

  // Fetch published packs with template counts
  const { data: packsData } = await supabase
    .from("template_packs")
    .select("id, pack_name, pack_description, slug, thumbnail_url, category, tags, access_level")
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
  else query = query.order("created_at", { ascending: false });

  const { data: prompts, error } = await query;

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
            Prompt Packs
          </h1>
          <p className="text-xl text-white/60 max-w-2xl">
            Curated collections of high-performance prompts. One click to remix and make them yours.
          </p>
        </div>
      </div>

      {/* Pack Carousel */}
      <div className="mt-12">
        <PackCarousel packs={packs} />
      </div>

      {/* Toolbar */}
      <div className="mt-12">
        <PromptsToolbar
          initialQuery={q}
          initialCategory={category}
          initialSort={sort}
          categories={categories}
        />
      </div>

      {/* Individual Templates */}
      <div className="mt-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B7FF00]/5 border border-[#B7FF00]/20 text-[#B7FF00]">
            <Palette size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Professional Templates</h2>
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 shadow-sm transition hover:bg-white/5 cursor-default">
              <Wand2 className="h-3.5 w-3.5 text-[#B7FF00]" />
              <span className="text-xs font-medium text-white">Pick a prompt and remix it</span>
            </div>
          </div>
        </div>

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
    </div>
  );
}
