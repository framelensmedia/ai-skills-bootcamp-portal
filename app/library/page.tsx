"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import GenerationLightbox from "@/components/GenerationLightbox";
import PromptCard from "@/components/PromptCard";
import { Pencil, Check, X, Trash2, Heart, Library, Image as ImageIcon, Star, Grid3X3, List } from "lucide-react";
import Link from "next/link";

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
  summary?: string | null;
  featured_image_url?: string | null;
  image_url?: string | null;
  media_url?: string | null;
};

type LibraryItem = {
  id: string; // Generation ID
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

type FavoriteItem =
  | { type: "prompt"; data: PromptPublicRow }
  | { type: "generation"; data: LibraryItem };

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

  // "remixes" = My Generations (prompt_generations)
  // "favorites" = My Favorites (prompt_favorites -> prompts_public / prompt_generations)
  const [activeTab, setActiveTab] = useState<"remixes" | "favorites">("remixes");

  const [remixItems, setRemixItems] = useState<LibraryItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  // Editing logic for Remixes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lbOriginal, setLbOriginal] = useState("");
  const [lbRemix, setLbRemix] = useState("");
  const [lbCombined, setLbCombined] = useState("");

  function openLightbox(it: LibraryItem) {
    setLbOriginal(it.originalPromptText);
    setLbRemix(it.remixPromptText);
    setLbCombined(it.combinedPromptText);
    setLightboxUrl(it.imageUrl);
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
    console.log("Share clicked:", url);
  }

  function handleRemix(payload: {
    imgUrl: string;
    originalPromptText: string;
    remixPromptText: string;
    combinedPromptText: string;
  }) {
    const href =
      `/studio?img=${encodeURIComponent(payload.imgUrl)}` +
      `&remix=${encodeURIComponent(payload.remixPromptText || "")}`;
    router.push(href);
  }

  async function handleUpdateTitle(id: string, overrideValue?: string) {
    const val = overrideValue !== undefined ? overrideValue : editingValue;
    if (!val.trim()) return;
    setSavingId(id);
    try {
      const res = await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, headline: val }),
      });
      if (!res.ok) throw new Error("Update failed");

      setRemixItems((prev) => prev.map((it) => (it.id === id ? { ...it, promptTitle: val } : it)));
    } catch (e) {
      console.error("Failed to update title", e);
    } finally {
      setSavingId(null);
      setEditingId(null);
      setEditingValue("");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    setRemixItems((prev) => prev.filter((it) => it.id !== id));
    try {
      const res = await fetch(`/api/library?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch (e) {
      console.error("Delete failed", e);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrorMsg(null);

      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        setRemixItems([]);
        setFavoriteItems([]);
        setLoading(false);
        setErrorMsg("Please log in to view your library.");
        return;
      }

      try {
        if (activeTab === "remixes") {
          // Fetch Remixes (prompt_generations)
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

          if (gensError) throw gensError;

          const genRows = (gens ?? []) as GenRow[];

          // Resolve prompt titles
          const promptIds = Array.from(new Set(genRows.map((g) => g.prompt_id).filter(Boolean))) as string[];
          const promptMap = new Map<string, PromptPublicRow>();

          if (promptIds.length) {
            const { data: prompts } = await supabase
              .from("prompts_public")
              .select("id, title, slug, category, access_level")
              .in("id", promptIds);
            (prompts ?? []).forEach((p: any) => promptMap.set(p.id, p as PromptPublicRow));
          }

          const built = genRows.map((g) => {
            const p = g.prompt_id ? promptMap.get(g.prompt_id) : null;
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
              createdAtMs: Date.parse(g.created_at || "") || 0,
              promptId: g.prompt_id,
              promptSlug: g.prompt_slug,
              aspectRatio: g?.settings?.aspectRatio ?? null,
              promptTitle: g.settings?.headline || p?.title || g.prompt_slug || "Untitled Remix",
              promptCategory: p?.category,
              originalPromptText,
              remixPromptText,
              combinedPromptText,
            } as LibraryItem;
          });

          setRemixItems(built);

        } else {
          // Fetch Favorites
          const { data: favs, error: favError } = await supabase
            .from("prompt_favorites")
            .select("prompt_id, generation_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (cancelled) return;
          if (favError) {
            console.warn("Fav fetch error (table missing?)", favError);
            setFavoriteItems([]);
            setLoading(false);
            return;
          }

          const favRows = favs ?? [];
          const promptIds = favRows.filter(f => f.prompt_id).map(f => f.prompt_id);

          let fetchedPrompts: PromptPublicRow[] = [];

          if (promptIds.length > 0) {
            const { data: pData } = await supabase
              .from("prompts_public")
              .select("id, title, slug, category, access_level, summary, featured_image_url, image_url, media_url")
              .in("id", promptIds);
            fetchedPrompts = (pData ?? []) as PromptPublicRow[];
          }

          const builtFavs: FavoriteItem[] = [];

          for (const fav of favRows) {
            if (fav.prompt_id) {
              const p = fetchedPrompts.find(x => x.id === fav.prompt_id);
              if (p) builtFavs.push({ type: "prompt", data: p });
            }
          }

          setFavoriteItems(builtFavs);
        }

      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [activeTab, sortMode, promptSlugFilter]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white font-sans">
      <GenerationLightbox
        open={lightboxOpen}
        url={lightboxUrl}
        onClose={closeLightbox}
        originalPromptText={lbOriginal}
        remixPromptText={lbRemix}
        combinedPromptText={lbCombined}
        onShare={handleShare}
        onRemix={handleRemix}
        title={remixItems.find(i => i.imageUrl === lightboxUrl)?.promptTitle}
        onRename={(newTitle) => {
          const item = remixItems.find(i => i.imageUrl === lightboxUrl);
          if (item) handleUpdateTitle(item.id, newTitle);
        }}
        onDelete={() => {
          const item = remixItems.find(i => i.imageUrl === lightboxUrl);
          if (item) {
            handleDelete(item.id);
            closeLightbox();
          }
        }}
      />

      {/* Technical Header */}
      <div className="mb-8 border-b border-white/10 pb-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-3xl">
              {promptSlugFilter ? `Filter: ${promptSlugFilter}` : "My Library"}
            </h1>
          </div>

          {/* Technical Tab Switcher */}
          <div className="flex bg-zinc-900 border border-white/10 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("remixes")}
              className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wide rounded-md transition-all ${activeTab === "remixes"
                ? "bg-[#B7FF00] text-black"
                : "text-white/40 hover:text-white"
                }`}
            >
              Remixes
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wide rounded-md transition-all ${activeTab === "favorites"
                ? "bg-[#B7FF00] text-black"
                : "text-white/40 hover:text-white"
                }`}
            >
              Favorites
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-white/40 uppercase tracking-wider">
          <span>{loading ? "LOAD..." : `${activeTab === "remixes" ? remixItems.length : favoriteItems.length} ITEMS`}</span>
          {promptSlugFilter && <span className="text-[#B7FF00]">• FILTER ACTIVE</span>}
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded-lg border border-white/10 bg-zinc-900 hover:border-white/20 text-white/60">
            <Grid3X3 size={16} />
          </button>
          <button className="p-2 rounded-lg border border-transparent hover:bg-white/5 text-white/30">
            <List size={16} />
          </button>
        </div>
      </div>

      {activeTab === "remixes" ? (
        // REMIXES GRID
        <section className="min-h-[300px]">
          {errorMsg && <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-300 font-mono text-xs rounded-lg mb-6">{errorMsg}</div>}

          {!loading && remixItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-xl bg-zinc-900/20">
              <div className="p-4 rounded-full bg-white/5 mb-3 text-white/20">
                <ImageIcon size={24} />
              </div>
              <div className="text-sm font-medium text-white/40">No assets found</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {remixItems.map((it) => (
              <div key={it.id} className="group relative bg-zinc-900/40 border border-white/5 transition-all hover:border-white/20 hover:bg-zinc-900">
                <button
                  className="relative aspect-square w-full overflow-hidden bg-black"
                  onClick={() => openLightbox(it)}
                >
                  <Image src={it.imageUrl} alt={it.promptTitle} fill className="object-cover" />

                  {/* Technical Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-white/80 truncate max-w-[80%]">{it.promptTitle}</span>
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDelete(it.id); }}
                      className="text-white/40 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        // FAVORITES GRID
        <section className="min-h-[300px]">
          {!loading && favoriteItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-xl bg-zinc-900/20">
              <div className="p-4 rounded-full bg-white/5 mb-3 text-white/20">
                <Star size={24} />
              </div>
              <div className="text-sm font-medium text-white/40">No favorites designated</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteItems.map((item, idx) => {
              if (item.type === "prompt") {
                const p = item.data;
                return (
                  <PromptCard
                    key={p.id + idx}
                    id={p.id}
                    title={p.title}
                    summary={p.summary || ""}
                    slug={p.slug}
                    featuredImageUrl={p.featured_image_url}
                    imageUrl={p.image_url}
                    mediaUrl={p.media_url}
                    category={p.category || undefined}
                    accessLevel={p.access_level || "free"}
                    initialFavorited={true}
                  />
                );
              }
              return null;
            })}
          </div>
        </section>
      )}
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white"><div className="h-5 w-5 animate-spin rounded-sm border-2 border-[#B7FF00] border-t-transparent"></div></div>}>
      <LibraryContent />
    </Suspense>
  );
}
