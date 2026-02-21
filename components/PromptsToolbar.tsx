"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, ChevronDown } from "lucide-react";

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

  const categoryOptions = useMemo(() => ["all", ...categories], [categories]);

  function apply(override?: { q?: string; category?: string; sort?: string }) {
    const finalQ = (override?.q ?? q).trim();
    const finalCat = (override?.category ?? category);
    const finalSort = (override?.sort ?? sort);

    const params = new URLSearchParams(sp?.toString() ?? "");

    if (finalQ) params.set("q", finalQ);
    else params.delete("q");

    if (finalCat && finalCat !== "all") params.set("category", finalCat);
    else params.delete("category");

    if (finalSort && finalSort !== "newest") params.set("sort", finalSort);
    else params.delete("sort");

    router.push(`/prompts?${params.toString()}`, { scroll: false });
  }

  function handleReset() {
    setQ("");
    setCategory("all");
    setSort("random");
    router.push(`/prompts`, { scroll: false });
  }

  return (
    <div className="w-full mb-8">
      <div className="flex flex-col md:flex-row gap-4">

        {/* Search Input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
            <Search className="h-4 w-4" />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply({ q: e.currentTarget.value })}
            onBlur={() => apply()}
            placeholder="Search prompts..."
            className="h-10 w-full rounded-lg border border-white/10 bg-zinc-900 pl-10 pr-10 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20 transition-colors"
          />
          {q && (
            <button
              onClick={() => {
                setQ("");
                apply({ q: "" });
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex w-full items-center gap-2 md:w-auto">

          {/* Category Select */}
          <div className="relative flex-1 md:flex-none md:w-48">
            <select
              value={category}
              onChange={(e) => {
                const val = e.target.value;
                setCategory(val);
                apply({ category: val });
              }}
              className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-zinc-900 pl-3 pr-10 text-sm text-white outline-none focus:border-white/20 transition-colors"
            >
              <option value="all" className="bg-zinc-900 text-white">All Categories</option>
              {categoryOptions.filter(c => c !== "all").map((c) => (
                <option key={c} value={c} className="bg-zinc-900 text-white">
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          </div>

          {/* Sort Select */}
          <div className="relative flex-1 md:flex-none md:w-48">
            <select
              value={sort}
              onChange={(e) => {
                const val = e.target.value;
                setSort(val);
                apply({ sort: val });
              }}
              className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-zinc-900 pl-3 pr-10 text-sm text-white outline-none focus:border-white/20 transition-colors"
            >
              <option value="random" className="bg-zinc-900 text-white">Random</option>
              <option value="newest" className="bg-zinc-900 text-white">Newest</option>
              <option value="oldest" className="bg-zinc-900 text-white">Oldest</option>
              <option value="title_az" className="bg-zinc-900 text-white">A-Z</option>
              <option value="title_za" className="bg-zinc-900 text-white">Z-A</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          </div>

          {/* Reset */}
          {(category !== "all" || (sort !== "random" && sort !== "newest") || q) && (
            <button
              onClick={handleReset}
              className="h-10 shrink-0 px-4 rounded-lg border border-white/10 bg-zinc-900 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Reset
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
