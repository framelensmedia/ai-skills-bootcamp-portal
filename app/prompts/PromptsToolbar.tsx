import Link from "next/link";

type Pack = {
  id: string;
  name: string;
  slug: string;
  is_featured?: boolean;
  featured_rank?: number;
};

export default function PromptsToolbar({ packs }: { packs: Pack[] }) {
  // This is a server component-friendly toolbar using plain links + GET form.
  // Filters via query string: ?q=&pack=&access=&sort=
  return (
    <div className="space-y-3">
      {/* Search + basic filters */}
      <form
        action="/prompts"
        method="GET"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input
          name="q"
          placeholder="Search prompts (ex: restaurant flyer, event promo, credit repair)…"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-lime-400/50"
        />

        <div className="flex gap-2">
          <select
            name="access"
            defaultValue="all"
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-lime-400/50"
          >
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>

          <select
            name="sort"
            defaultValue="featured"
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-lime-400/50"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
          >
            Apply
          </button>
        </div>
      </form>

      {/* Pack chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <Link
          href="/prompts"
          className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          All Packs
        </Link>

        {packs.map((p) => (
          <Link
            key={p.id}
            href={`/prompts?pack=${encodeURIComponent(p.slug)}`}
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            {p.slug}
          </Link>
        ))}
      </div>
    </div>
  );
}
