import PromptCard from "@/components/PromptCard";
import PromptsToolbar from "@/components/PromptsToolbar";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type SearchParams = {
  q?: string;
  category?: string;
  sort?: "newest" | "oldest" | "title_az" | "title_za";
};

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createSupabaseServerClient();

  const q = (searchParams.q ?? "").trim();
  const category = (searchParams.category ?? "all").trim().toLowerCase();
  const sort = (searchParams.sort ?? "newest").trim();

  // Build query from SAFE VIEW
  let query = supabase
    .from("prompts_public")
    .select(
      "id,title,slug,summary,category,access_level,image_url,featured_image_url,media_url,created_at"
    );

  if (q) {
    // Basic search: title OR summary OR category
    query = query.or(
      `title.ilike.%${q}%,summary.ilike.%${q}%,category.ilike.%${q}%`
    );
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Prompts</h1>
        <p className="mt-2 text-sm text-white/70">
          Browse prompt packs and individual prompts. Click any prompt to open the tool.
        </p>
      </div>

      <PromptsToolbar
        initialQuery={q}
        initialCategory={category || "all"}
        initialSort={sort || "newest"}
        categories={categories}
      />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(prompts ?? []).map((p) => {
          const image =
            p.featured_image_url || p.image_url || p.media_url || null;

          return (
            <PromptCard
              key={p.id}
              title={p.title}
              summary={p.summary || ""}
              slug={p.slug}
              category={p.category || "general"}
              imageUrl={image}
              accessLevel={p.access_level || "free"}
            />
          );
        })}
      </div>
    </main>
  );
}
