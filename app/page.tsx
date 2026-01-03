"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import PromptCard from "@/components/PromptCard";

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#B7FF00]">
      {text}
    </span>
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

type PublicPrompt = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: string | null;
  access_level: string;
  created_at: string | null;

  featured_image_url: string | null;
  image_url: string | null;
  media_url: string | null;
};

function FeaturedPromptSlider({ items }: { items: PublicPrompt[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => {
      setIdx((prev) => (prev + 1) % items.length);
    }, 3500);
    return () => clearInterval(t);
  }, [items.length]);

  const active = items[idx];

  if (!active) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/50" />
        <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
          <p className="text-xs text-white/60">Featured prompts</p>
          <p className="mt-1 text-sm font-semibold text-white">Loading…</p>
        </div>
      </div>
    );
  }

  const href = `/prompts/${encodeURIComponent(active.slug)}`;

  const bestImage =
    (active.featured_image_url ?? "").trim() ||
    (active.image_url ?? "").trim() ||
    (active.media_url ?? "").trim();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <Link href={href} className="block">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bestImage.length ? bestImage : "/orb-neon.gif"}
            alt={active.title}
            className={[
              "h-full w-full object-cover transition duration-300",
              bestImage.length ? "opacity-90" : "brightness-[0.55]",
            ].join(" ")}
            loading="lazy"
            referrerPolicy="no-referrer"
          />

          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/85">
              {(active.category ?? "general").toUpperCase()}
            </span>

            {String(active.access_level || "free").toLowerCase() === "premium" ? (
              <span className="rounded-full border border-lime-400/30 bg-lime-400/15 px-3 py-1 text-[11px] text-lime-200">
                PRO
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="min-w-0">
            <p className="text-xs text-white/60">Featured prompt</p>
            <p className="truncate text-sm font-semibold text-white">{active.title}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">Action</p>
            <p className="text-sm font-semibold text-[#B7FF00]">Open →</p>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {items.map((_, i) => (
          <span
            key={i}
            className={[
              "h-1.5 w-1.5 rounded-full border border-white/10",
              i === idx ? "bg-[#B7FF00]" : "bg-white/20",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [recentPrompts, setRecentPrompts] = useState<PublicPrompt[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setRecentLoading(true);

      try {
        const { data, error } = await supabase
          .from("prompts_public")
          .select(
            "id, title, slug, summary, category, access_level, created_at, featured_image_url, image_url, media_url"
          )
          .order("created_at", { ascending: false })
          .limit(12);

        if (cancelled) return;

        if (error) setRecentPrompts([]);
        else setRecentPrompts((data || []) as PublicPrompt[]);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const sliderPrompts = useMemo(() => recentPrompts.slice(0, 5), [recentPrompts]);
  const trendingPrompts = useMemo(() => recentPrompts.slice(0, 4), [recentPrompts]);

  return (
    <div className="bg-black text-white">
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <div>
            <Tag text="Prompts you can use instantly" />

            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Learn Real <span className="text-[#B7FF00]">AI Skills</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              Learn AI Skills that earn real money. Enjoy access to hundreds of prompts, templates, courses, and tools.
            </p>

            {/* MOBILE ONLY: slider goes above search/CTA */}
            <div className="mt-6 md:hidden">
              {recentLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/50" />
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
                    <p className="text-xs text-white/60">Featured prompts</p>
                    <p className="mt-1 text-sm font-semibold text-white">Loading…</p>
                  </div>
                </div>
              ) : (
                <FeaturedPromptSlider items={sliderPrompts.length ? sliderPrompts : []} />
              )}
            </div>

{/* CONTROLS */}
<div className="mt-6 max-w-xl">
  {/* Search (full width) */}
  <div className="mb-4 flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-3">
    <span className="text-xs text-white/60">🔎</span>
    <input
      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
      placeholder="Search prompts (flyers, ads, product photos, thumbnails...)"
    />
  </div>

  {/* CTA Row (matches search width exactly) */}
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <Link
      href="/prompts"
      className="inline-flex w-full items-center justify-center rounded-md bg-[#B7FF00] px-6 py-4 text-sm font-semibold text-black hover:opacity-90"
    >
      Browse Prompts →
    </Link>

    <Link
      href="/studio"
      className="inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white hover:bg-white/10"
    >
      Open Prompt Studio →
    </Link>
  </div>
</div>


            <div className="mt-5 flex items-center gap-3 text-xs text-white/60">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                ★
              </span>
              Built for entrepreneurs and creators
            </div>
          </div>

          {/* DESKTOP ONLY: slider stays on right */}
          <div className="hidden md:block">
            {recentLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/50" />
                <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-xs text-white/60">Featured prompts</p>
                  <p className="mt-1 text-sm font-semibold text-white">Loading…</p>
                </div>
              </div>
            ) : (
              <FeaturedPromptSlider items={sliderPrompts.length ? sliderPrompts : []} />
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

      {/* TRENDING PROMPTS */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">Trending</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">Prompts</h2>
            <p className="mt-2 text-sm text-white/60">Latest published prompts (auto-filled for internal testing).</p>
          </div>

          <Link href="/prompts" className="hidden text-sm text-white/70 hover:text-white md:block">
            View all →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentLoading ? (
            <>
              <div className="h-[260px] rounded-2xl border border-white/10 bg-white/5" />
              <div className="h-[260px] rounded-2xl border border-white/10 bg-white/5" />
              <div className="h-[260px] rounded-2xl border border-white/10 bg-white/5" />
              <div className="h-[260px] rounded-2xl border border-white/10 bg-white/5" />
            </>
          ) : trendingPrompts.length ? (
            trendingPrompts.map((p) => (
              <PromptCard
                key={p.id}
                title={p.title}
                summary={p.summary || ""}
                slug={p.slug}
                category={p.category || "general"}
                accessLevel={p.access_level}
                featuredImageUrl={p.featured_image_url}
                imageUrl={p.image_url}
                mediaUrl={p.media_url}
              />
            ))
          ) : (
            <div className="text-sm text-white/60">No prompts found yet. Publish a few and they’ll appear here.</div>
          )}
        </div>

        <div className="mt-6 md:hidden">
          <Link href="/prompts" className="text-sm text-white/70 hover:text-white">
            View all →
          </Link>
        </div>
      </section>

      {/* TUTORIALS (unchanged) */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:pb-14">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">Learn the system</p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Tutorials</h2>
          <p className="mt-2 text-sm text-white/60">Quick guides so users understand how to remix prompts the right way.</p>
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
