"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialQuery: string;
  initialCategory: string; // "all" or lowercased category
  initialSort: string; // newest | oldest | title_az | title_za
  categories: string[];
};

export default function PromptsToolbar({
  initialQuery,
  initialCategory,
  initialSort,
  categories,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);

  const categoryOptions = useMemo(() => {
    return ["all", ...categories];
  }, [categories]);

  function apply() {
    const params = new URLSearchParams(sp?.toString() ?? "");

    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");

    if (category && category !== "all") params.set("category", category);
    else params.delete("category");

    if (sort && sort !== "newest") params.set("sort", sort);
    else params.delete("sort");

    router.push(`/prompts?${params.toString()}`);
  }

  function reset() {
    setQ("");
    setCategory("all");
    setSort("newest");
    router.push(`/prompts`);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
        <div className="md:col-span-5">
          <label className="text-sm text-white/70">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prompts..."
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white/25"
          />
        </div>

        <div className="md:col-span-4">
          <label className="text-sm text-white/70">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All" : c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-sm text-white/70">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title_az">Title (A-Z)</option>
            <option value="title_za">Title (Z-A)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          onClick={apply}
          className="inline-flex items-center justify-center rounded-xl bg-lime-400 px-5 py-3 text-sm font-semibold text-black hover:bg-lime-300"
        >
          Apply
        </button>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
