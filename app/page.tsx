"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
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

// Typewriter Component
function Typewriter({ text, className = "", gradientWords = [] }: { text: string; className?: string; gradientWords?: string[] }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Calculate total duration roughly: (text length in chars + spaces) * 100ms
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (visible) {
      const totalChars = text.length;
      const duration = totalChars * 100 + 500; // +0.5s buffer
      const t = setTimeout(() => setComplete(true), duration);
      return () => clearTimeout(t);
    }
  }, [visible, text]);

  const words = text.split(" ");

  return (
    <span ref={ref} className={className}>
      {words.map((word, wordIndex) => {
        const isGradient = gradientWords.includes(word);
        // We need cumulative character count for delay? 
        // Or just simplify: assume text is "AI Made Easy"
        // Words: ["AI", "Made", "Easy"]
        // Delay offset calculation
        const previousChars = words.slice(0, wordIndex).join(" ").length + (wordIndex > 0 ? 1 : 0);

        return (
          <span key={wordIndex}>
            {word.split("").map((char, charIndex) => (
              <span
                key={charIndex}
                className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'} ${isGradient ? "text-transparent bg-clip-text bg-gradient-to-r from-[#B7FF00] to-green-400" : "text-white"}`}
                style={{ transitionDelay: `${(previousChars + charIndex) * 100}ms` }}
              >
                {char}
              </span>
            ))}
            {wordIndex < words.length - 1 && (
              <span
                className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: `${(previousChars + word.length) * 100}ms` }}
              >&nbsp;</span>
            )}
          </span>
        );
      })}
      <span className={`inline-block ml-1 text-[#B7FF00] transition-opacity duration-1000 ${!complete ? "animate-pulse" : ""} ${visible && !complete ? 'opacity-100' : 'opacity-0'}`}>|</span>
    </span>
  );
}

export default function HomePage() {

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [recentPrompts, setRecentPrompts] = useState<PublicPrompt[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setRecentLoading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();

        const [promptsRes, favRes] = await Promise.all([
          supabase
            .from("prompts_public")
            .select(
              "id, title, slug, summary, category, access_level, created_at, featured_image_url, image_url, media_url"
            )
            .order("created_at", { ascending: false })
            .limit(12),
          user
            ? supabase.from("prompt_favorites").select("prompt_id").eq("user_id", user.id)
            : Promise.resolve({ data: [] })
        ]);

        if (cancelled) return;

        if (promptsRes.error) {
          setRecentPrompts([]);
        } else {
          setRecentPrompts((promptsRes.data || []) as PublicPrompt[]);
        }

        const ids = new Set<string>();
        (favRes.data || []).forEach((f: any) => {
          if (f.prompt_id) ids.add(f.prompt_id);
        });
        setFavoriteIds(ids);

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
    <>
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/5 px-3 py-1.5 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B7FF00] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B7FF00]"></span>
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B7FF00]">No technical skills required</span>
            </div>

            <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-7xl">
              <Typewriter text="AI Made Easy" gradientWords={["AI"]} />
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
              The all-in-one platform to launch your business with AI. Master the skills, create pro-level content, and start generating revenue faster than ever.
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      window.location.href = `/prompts?q=${encodeURIComponent(e.currentTarget.value)}`;
                    }
                  }}
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


      {/* TRENDING PROMPTS */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B7FF00]/10 text-[#B7FF00]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Trending Prompts</h2>
              <p className="text-xs text-white/50 font-medium">Community favorites, ready to remix.</p>
            </div>
          </div>

          <Link href="/prompts" className="group hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20">
            <span>View More Prompts</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50 transition-transform group-hover:translate-x-0.5 group-hover:text-white">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
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
                id={p.id}
                title={p.title}
                summary={p.summary || ""}
                slug={p.slug}
                category={p.category || undefined}
                accessLevel={p.access_level}
                imageUrl={p.image_url || p.featured_image_url || p.media_url}
                initialFavorited={favoriteIds.has(p.id)}
              />
            ))
          ) : (
            <div className="text-sm text-white/60">No prompts found yet. Publish a few and they’ll appear here.</div>
          )}
        </div>

        <div className="mt-8 flex justify-center md:hidden">
          <Link href="/prompts" className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20">
            <span>View More Prompts</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50 transition-transform group-hover:translate-x-0.5 group-hover:text-white">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>

      {/* TUTORIALS (unchanged) */}
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-10 md:pt-32 md:pb-14">
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
    </>
  );
}
