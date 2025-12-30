import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PromptsToolbar from "@/components/PromptsToolbar";
import PromptCard from "@/components/PromptCard";

type SearchParams = {
  q?: string;
  category?: string;
  sort?: string;
};

type PromptRow = {
  id: string;
  title: string;
  summary: string | null;
  slug: string;
  image_url: string | null;
  category: string | null;
  created_at: string | null;
  is_featured: boolean | null;
  is_published: boolean | null;
};

export default async function PromptsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const q = (searchParams?.q ?? "").trim();
  const category = (searchParams?.category ?? "all").toLowerCase();
  const sort = (searchParams?.sort ?? "newest").toLowerCase();

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("prompts")
    .select(
      "id, title, summary, slug, image_url, category, created_at, is_featured, is_published"
    )
    .eq("is_published", true);

  if (category !== "all") {
    // Use ilike so DB values like "Restaurant" still match "restaurant"
    query = query.ilike("category", category);
  }

  if (q.length > 0) {
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
  }

  if (sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (sort === "title_az") {
    query = query.order("title", { ascending: true });
  } else if (sort === "title_za") {
    query = query.order("title", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  const prompts = (data ?? []) as PromptRow[];

  const categories = Array.from(
    new Set(
      prompts
        .map((p) => (p.category ?? "").trim())
        .filter((c) => c.length > 0)
        .map((c) => c.toLowerCase())
    )
  ).sort();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Prompts
        </h1>
        <p className="mt-2 text-base text-white/70 sm:text-lg">
          Browse prompts and prompt packs. Click a card to open the tool view.
        </p>
      </div>

      <div className="mb-8">
        <PromptsToolbar
          initialQuery={q}
          initialCategory={category}
          initialSort={sort}
          categories={categories}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
          <div className="text-lg font-semibold text-red-200">
            Prompts query failed
          </div>
          <div className="mt-2 text-sm text-red-200/80">{error.message}</div>
        </div>
      ) : prompts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">No prompts found</div>
          <div className="mt-2 text-sm text-white/70">
            Try changing the search or category.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((p) => (
            <PromptCard
              key={p.id}
              title={p.title}
              summary={p.summary ?? ""}
              slug={(p.slug ?? "").trim().toLowerCase()}
              imageUrl={p.image_url}
              category={p.category ?? "general"}
            />
          ))}
        </div>
      )}
    </main>
  );
}
