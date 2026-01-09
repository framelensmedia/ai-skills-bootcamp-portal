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

    router.push(`/prompts?${params.toString()}`);
  }

  function handleReset() {
    setQ("");
    setCategory("all");
    setSort("newest");
    router.push(`/prompts`);
  }

  return (
    <div className="sticky top-4 z-20 mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl p-3 md:flex-row md:items-center">

        {/* Search Input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
            <Search className="h-5 w-5" />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply({ q: e.currentTarget.value })}
            onBlur={() => apply()}
            placeholder="Search prompts..."
            className="h-12 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-10 text-sm font-medium text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/20 focus:bg-white/10"
          />
          {q && (
            <button
              onClick={() => {
                setQ("");
                apply({ q: "" });
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible">

          {/* Category Dropdown */}
          <div className="relative shrink-0">
            <select
              value={category}
              onChange={(e) => {
                const val = e.target.value;
                setCategory(val);
                apply({ category: val });
              }}
              className="h-12 appearance-none rounded-xl border border-white/5 bg-white/5 pl-4 pr-10 text-sm font-medium text-white outline-none transition-colors hover:bg-white/10 focus:border-white/20"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c} className="bg-neutral-900 text-white">
                  {c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => {
                const val = e.target.value;
                setSort(val);
                apply({ sort: val });
              }}
              className="h-12 appearance-none rounded-xl border border-white/5 bg-white/5 pl-4 pr-10 text-sm font-medium text-white outline-none transition-colors hover:bg-white/10 focus:border-white/20"
            >
              <option value="newest" className="bg-neutral-900 text-white">Newest</option>
              <option value="oldest" className="bg-neutral-900 text-white">Oldest</option>
              <option value="title_az" className="bg-neutral-900 text-white">A-Z</option>
              <option value="title_za" className="bg-neutral-900 text-white">Z-A</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          </div>

          {/* Reset Button (only if filters active) */}
          {(category !== "all" || sort !== "newest" || q) && (
            <button
              onClick={handleReset}
              className="flex h-12 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 px-4 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
