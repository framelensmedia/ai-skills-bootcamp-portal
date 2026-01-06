"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import GenerationLightbox from "@/components/GenerationLightbox";

type SortMode = "newest" | "oldest";

type GenRow = {
  id: string;
  image_url: string;
  created_at: string;
  prompt_id: string | null;
  prompt_slug: string | null;
  settings: any;

  // ✅ standardized columns
  original_prompt_text: string | null;
  remix_prompt_text: string | null;
  combined_prompt_text: string | null;
};

type PromptPublicRow = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  access_level: string | null;
};

type LibraryItem = {
  id: string;
  imageUrl: string;
  createdAt: string;
  createdAtMs: number;
  promptId: string | null;
  promptSlug: string | null;
  aspectRatio: string | null;

  promptTitle: string;
  promptCategory: string | null;

  originalPromptText: string;
  remixPromptText: string;
  combinedPromptText: string;
};

function normalize(v: any) {
  return String(v ?? "").trim();
}

function fallbackFromSettings(settings: any) {
  const s = settings || {};

  const original =
    normalize(s?.original_prompt_text) ||
    normalize(s?.originalPromptText) ||
    normalize(s?.originalPrompt) ||
    normalize(s?.prompt) ||
    normalize(s?.promptText) ||
    "";

  const remix =
    normalize(s?.remix_prompt_text) ||
    normalize(s?.remixPromptText) ||
    normalize(s?.remixAdditions) ||
    normalize(s?.remixPrompt) ||
    "";

  const combined =
    normalize(s?.combined_prompt_text) ||
    normalize(s?.combinedPromptText) ||
    normalize(s?.combinedPrompt) ||
    normalize(s?.finalPrompt) ||
    "";

  return { original, remix, combined };
}

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const promptSlugFilter = normalize(searchParams?.get("promptSlug") || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [items, setItems] = useState<LibraryItem[]>([]);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [lbOriginal, setLbOriginal] = useState("");
  const [lbRemix, setLbRemix] = useState("");
  const [lbCombined, setLbCombined] = useState("");

  function openLightbox(it: LibraryItem) {
    setLightboxUrl(it.imageUrl);
    setLbOriginal(it.originalPromptText);
    setLbRemix(it.remixPromptText);
    setLbCombined(it.combinedPromptText);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxUrl(null);
    setLbOriginal("");
    setLbRemix("");
    setLbCombined("");
  }

  function handleShare(url: string) {
    console.log("Share clicked (placeholder):", url);
  }

  function handleRemix(payload: {
    imgUrl: string;
    originalPromptText: string;
    remixPromptText: string;
    combinedPromptText: string;
  }) {
    const href =
      `/studio?img=${encodeURIComponent(payload.imgUrl)}` +
      `&original=${encodeURIComponent(payload.originalPromptText || "")}` +
      `&remix=${encodeURIComponent(payload.remixPromptText || "")}`;
    router.push(href);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrorMsg(null);

      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setItems([]);
        setLoading(false);
        setErrorMsg("Please log in to view your library.");
        return;
      }

      try {
        let q = supabase
          .from("prompt_generations")
          .select(
            "id, image_url, created_at, prompt_id, prompt_slug, settings, original_prompt_text, remix_prompt_text, combined_prompt_text"
          )
          .eq("user_id", user.id)
          .limit(200);

        if (promptSlugFilter) q = q.eq("prompt_slug", promptSlugFilter);
        q = q.order("created_at", { ascending: sortMode === "oldest" });

        const { data: gens, error: gensError } = await q;
        if (cancelled) return;

        if (gensError) {
          setErrorMsg(gensError.message);
          setItems([]);
          setLoading(false);
          return;
        }

        const genRows = (gens ?? []) as GenRow[];

        // Get titles for prompt_id rows
        const promptIds = Array.from(new Set(genRows.map((g) => g.prompt_id).filter(Boolean))) as string[];
        const promptMap = new Map<string, PromptPublicRow>();

        if (promptIds.length) {
          const { data: prompts } = await supabase
            .from("prompts_public")
            .select("id, title, slug, category, access_level")
            .in("id", promptIds);

          (prompts ?? []).forEach((p: any) => promptMap.set(p.id, p as PromptPublicRow));
        }

        const built: LibraryItem[] = genRows.map((g) => {
          const p = g.prompt_id ? promptMap.get(g.prompt_id) : null;

          const createdAtMs = Date.parse(g.created_at || "") || 0;
          const aspectRatio = g?.settings?.aspectRatio ?? null;

          const fb = fallbackFromSettings(g?.settings);

          const originalPromptText = normalize(g.original_prompt_text) || fb.original;
          const remixPromptText = normalize(g.remix_prompt_text) || fb.remix;
          const combinedPromptText =
            normalize(g.combined_prompt_text) ||
            fb.combined ||
            [originalPromptText, remixPromptText].filter(Boolean).join("\n\n");

          return {
            id: g.id,
            imageUrl: g.image_url,
            createdAt: g.created_at,
            createdAtMs,
            promptId: g.prompt_id ?? null,
            promptSlug: g.prompt_slug ?? null,
            aspectRatio,

            promptTitle: p?.title || g.prompt_slug || "Unknown prompt",
            promptCategory: p?.category ?? null,

            originalPromptText,
            remixPromptText,
            combinedPromptText,
          };
        });

        setItems(built);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message || "Failed to load library.");
        setItems([]);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sortMode, promptSlugFilter]);

  const headerLabel = useMemo(() => {
    if (promptSlugFilter) return `My Library: ${promptSlugFilter}`;
    return "My Library";
  }, [promptSlugFilter]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      <GenerationLightbox
        open={lightboxOpen}
        url={lightboxUrl}
        onClose={closeLightbox}
        originalPromptText={lbOriginal}
        remixPromptText={lbRemix}
        combinedPromptText={lbCombined}
        onShare={handleShare}
        onRemix={handleRemix}
      />

      <div className="mb-5 sm:mb-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{headerLabel}</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">
              Your generated images across all prompts. Click any image to view full screen.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {promptSlugFilter ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
                onClick={() => router.push("/library")}
              >
                Clear filter
              </button>
            ) : null}

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm hover:bg-black/50"
              onClick={() => router.push("/prompts")}
            >
              Back to Prompts
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-black/40 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">Controls</div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="text-xs text-white/55">{loading ? "Loading..." : `${items.length} item(s)`}</div>

            <div className="flex gap-2">
              <SelectPill label="Newest" selected={sortMode === "newest"} onClick={() => setSortMode("newest")} />
              <SelectPill label="Oldest" selected={sortMode === "oldest"} onClick={() => setSortMode("oldest")} />
            </div>
          </div>
        </div>

        {errorMsg ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
            {errorMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Loading your library…</div>
        ) : items.length === 0 ? (
          <div className="mt-4 text-sm text-white/60">No items yet. Go generate a few images and they will show up here.</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <div key={it.id} className="rounded-2xl border border-white/10 bg-black/30 p-2">
                <button
                  type="button"
                  className="group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-black hover:border-white/25"
                  onClick={() => openLightbox(it)}
                  title="Tap to view full screen"
                >
                  <div className="relative aspect-square w-full">
                    <Image src={it.imageUrl} alt="Generated" fill className="object-cover" />
                  </div>
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="absolute inset-0 bg-black/20" />
                  </div>
                </button>

                <div className="mt-2 flex flex-col gap-1 px-1">
                  <div className="text-xs font-semibold text-white/85 line-clamp-1">{it.promptTitle}</div>

                  <div className="flex flex-wrap items-center gap-2">
                    {it.promptSlug ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-white/65 hover:border-white/25"
                        onClick={() => router.push(`/prompts/${encodeURIComponent(it.promptSlug!)}`)}
                        title="Open prompt"
                      >
                        {it.promptSlug}
                      </button>
                    ) : null}

                    {it.aspectRatio ? (
                      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-white/55">
                        {it.aspectRatio}
                      </span>
                    ) : null}
                  </div>

                  <div className="text-[11px] text-white/45">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SelectPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const base = "rounded-xl border px-3 py-2 text-sm text-left transition";
  const idleCls = "border-white/15 bg-black/40 text-white/80 hover:bg-black/55 hover:border-white/25";
  const selectedCls = "border-lime-400/60 bg-lime-400/15 text-white hover:bg-lime-400/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[base, selected ? selectedCls : idleCls].join(" ")}
      aria-pressed={selected ? "true" : "false"}
    >
      {label}
    </button>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 text-white">Loading library...</div>}>
      <LibraryContent />
    </Suspense>
  );
}
