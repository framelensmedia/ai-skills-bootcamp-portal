"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import FeaturedPromptSlider from "@/app/components/FeaturedPromptSlider";

type PublicPromptRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: string | null;
  access_level: string;
  created_at: string | null;

  // optional fields depending on your view
  featured_image_url: string | null;
  image_url: string | null;
  media_url: string | null;
};

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#B7FF00]">
      {text}
    </span>
  );
}

function PromptCard({
  category,
  title,
  access,
  creator = "AI Skills Bootcamp",
  href = "/prompts",
}: {
  category: string;
  title: string;
  access: "FREE" | "PRO";
  creator?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20"
    >
      <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#B7FF00]">{category}</span>

        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide ${
            access === "PRO"
              ? "border-[#B7FF00]/30 bg-[#B7FF00]/10 text-[#B7FF00]"
              : "border-white/10 bg-black/30 text-white/70"
          }`}
        >
          {access}
        </span>
      </div>

      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-white/60">by {creator}</span>
        <span className="text-xs text-white/60 hover:text-white">Open →</span>
      </div>
    </Link>
  );
}

function MiniCard({
  tag,
  title,
  desc,
  comingSoon,
}: {
  tag: string;
  title: string;
  desc: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
      <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
      <p className="mt-4 text-xs font-semibold text-[#B7FF00]">
        {tag}{" "}
        {comingSoon ? (
          <span className="ml-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60">
            COMING SOON
          </span>
        ) : null}
      </p>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{desc}</p>
      <div className="mt-4">
        <span className="text-xs text-white/60 hover:text-white">
          {comingSoon ? "Preview →" : "Read now →"}
        </span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="aspect-[16/10] rounded-xl bg-white/5" />
      <div className="mt-4 flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-white/5" />
        <div className="h-4 w-12 rounded bg-white/5" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded bg-white/5" />
      <div className="mt-3 h-4 w-2/3 rounded bg-white/5" />
    </div>
  );
}

export default function HomePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [recent, setRecent] = useState<PublicPromptRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentPrompts() {
      setRecentLoading(true);
      setRecentError(null);

      try {
        const { data, error } = await supabase
          .from("prompts_public")
          .select(
            "id, title, slug, summary, category, access_level, created_at, featured_image_url, image_url, media_url"
          )
          .order("created_at", { ascending: false })
          .limit(12);

        if (error) throw error;

        if (!cancelled) {
          setRecent((data ?? []) as PublicPromptRow[]);
        }
      } catch (e: any) {
        if (!cancelled) {
          setRecentError(e?.message || "Failed to load prompts");
          setRecent([]);
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    }

    loadRecentPrompts();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const sliderItems = useMemo(() => {
    return (recent ?? []).slice(0, 5).map((p) => {
      const access = String(p.access_level || "free").toLowerCase() === "premium" ? "PRO" : "FREE";
      const category = (p.category || "General").toString().toUpperCase();

      return {
        category,
        title: p.title || "(untitled)",
        access,
        href: `/prompts/${encodeURIComponent(p.slug)}`,
        summary:
          (p.summary || "").trim() ||
          "Open this prompt, add remix instructions, and generate output in seconds.",
        imageUrl:
          (p.featured_image_url || "").trim() ||
          (p.image_url || "").trim() ||
          (p.media_url || "").trim() ||
          "",
      };
    });
  }, [recent]);

  const trendingGrid = useMemo(() => {
    // Use the next 4 most recent for the grid.
    // If you want overlap, change slice(5, 9) to slice(0, 4).
    return (recent ?? []).slice(5, 9);
  }, [recent]);

  return (
    <div className="bg-black">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <div>
            <Tag text="Prompts you can use instantly" />

            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Learn Real <span className="text-[#B7FF00]">AI Skills</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              Learn AI Skills that earn real money. Enjoy access to hundreds of prompts, templates,
              courses, and tools.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 sm:w-auto">
                <span className="text-xs text-white/60">🔎</span>
                <input
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                  placeholder="Search prompts (flyers, ads, product photos, thumbnails...)"
                />
              </div>

              <Link
                href="/prompts"
                className="inline-flex w-full items-center justify-center rounded-md bg-[#B7FF00] px-4 py-3 text-sm font-semibold text-black hover:opacity-90 sm:w-auto"
              >
                Browse Prompts →
              </Link>

              <Link
                href="/studio"
                className="inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                Open Prompt Studio →
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-3 text-xs text-white/60">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                ★
              </span>
              Built for entrepreneurs and creators
            </div>
          </div>

          {/* Featured Prompts Slider (most recent prompts) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {recentError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                {recentError}
              </div>
            ) : null}

            {recentLoading ? (
              <div className="space-y-3">
                <div className="aspect-[16/10] rounded-xl bg-white/5" />
                <div className="h-4 w-1/3 rounded bg-white/5" />
                <div className="h-6 w-3/4 rounded bg-white/5" />
                <div className="h-4 w-2/3 rounded bg-white/5" />
              </div>
            ) : sliderItems.length ? (
              <FeaturedPromptSlider items={sliderItems} />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                No prompts yet. Add your first prompt in the CMS and it will show up here automatically.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CATEGORY BAR */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          {["All", "Flyers", "Ads", "Product", "Thumbnails", "Branding", "UGC"].map((c) => (
            <button
              key={c}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${
                c === "All"
                  ? "bg-white text-black"
                  : "border border-white/10 bg-black/30 text-white/70 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* TRENDING PROMPTS (most recent prompts) */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">
              Trending
            </p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">Prompts</h2>
            <p className="mt-2 text-sm text-white/60">
              Auto-filled with the most recent prompts so you can start testing immediately.
            </p>
          </div>
          <Link href="/prompts" className="hidden text-sm text-white/70 hover:text-white md:block">
            View all →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : trendingGrid.length ? (
            trendingGrid.map((p) => {
              const access = String(p.access_level || "free").toLowerCase() === "premium" ? "PRO" : "FREE";
              const category = (p.category || "General").toString().toUpperCase();

              return (
                <PromptCard
                  key={p.id}
                  category={category}
                  title={p.title || "(untitled)"}
                  access={access}
                  href={`/prompts/${encodeURIComponent(p.slug)}`}
                />
              );
            })
          ) : (
            <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              No prompts yet. Publish a few prompts in the CMS and they will appear here.
            </div>
          )}
        </div>

        <div className="mt-6 md:hidden">
          <Link href="/prompts" className="text-sm text-white/70 hover:text-white">
            View all →
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS / RESOURCES */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:pb-14">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">
            Learn the system
          </p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Tutorials</h2>
          <p className="mt-2 text-sm text-white/60">
            Quick guides so users understand how to remix prompts the right way.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MiniCard
            tag="REMIXING"
            title="How to remix prompts for your offer"
            desc="Swap in product images, change the headline, and keep the style locked."
            comingSoon
          />
          <MiniCard
            tag="REFERENCE IMAGES"
            title="How to use uploads for better results"
            desc="Upload up to 10 images to guide style, layout, and branding."
            comingSoon
          />
          <MiniCard
            tag="WORKFLOW"
            title="Prompt → Studio → Library"
            desc="Use prompts for speed, Studio for custom work, Library to reuse winners."
            comingSoon
          />
        </div>
      </section>

      {/* TESTIMONIAL STRIP */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:pb-14">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center md:p-10">
          <p className="text-sm text-white/70">
            “I stopped guessing and started executing. The prompts and remix tool paid for themselves fast.”
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/50">
            Member, AI Skills Bootcamp
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-black p-6 text-center md:p-10">
          <h2 className="text-2xl font-black md:text-4xl">
            READY TO <span className="text-[#B7FF00]">GENERATE?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 md:text-base">
            Start with free prompts. Upgrade for Pro prompts and the fastest workflow for content production.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/prompts"
              className="inline-flex w-full justify-center rounded-md bg-[#B7FF00] px-5 py-3 text-sm font-semibold text-black hover:opacity-90 sm:w-auto"
            >
              Browse Prompts
            </Link>
            <Link
              href="/studio"
              className="inline-flex w-full justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Open Prompt Studio
            </Link>
            <Link
              href="/pricing"
              className="inline-flex w-full justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Upgrade to Pro
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/50">Free tier available. Upgrade anytime.</p>
        </div>
      </section>
    </div>
  );
}
