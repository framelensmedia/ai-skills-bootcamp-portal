"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import GenerationLightbox from "@/components/GenerationLightbox";
import PromptCard from "@/components/PromptCard";
import { Pencil, Check, X, Trash2, Heart } from "lucide-react";

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

  const itemsToShow = activeTab === "remixes" ? remixItems : [];

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
            // If favoriting table doesn't exist yet, just clear
            console.warn("Fav fetch error (table missing?)", favError);
            setFavoriteItems([]);
            setLoading(false);
            return;
          }

          const favRows = favs ?? [];
          const promptIds = favRows.filter(f => f.prompt_id).map(f => f.prompt_id);
          const genIds = favRows.filter(f => f.generation_id).map(f => f.generation_id);

          let fetchedPrompts: PromptPublicRow[] = [];

          if (promptIds.length > 0) {
            const { data: pData } = await supabase
              .from("prompts_public")
              .select("id, title, slug, category, access_level, summary, featured_image_url, image_url, media_url")
              .in("id", promptIds);
            fetchedPrompts = (pData ?? []) as PromptPublicRow[];
          }

          // TODO: Fetch generations if needed. For now assuming minimal generations favorite support or implementation later upon user request.
          // Mixing lists.

          const builtFavs: FavoriteItem[] = [];

          // Map back in order of Favorites
          for (const fav of favRows) {
            if (fav.prompt_id) {
              const p = fetchedPrompts.find(x => x.id === fav.prompt_id);
              if (p) builtFavs.push({ type: "prompt", data: p });
            }
            // generation handling would go here
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

  const headerLabel = useMemo(() => {
    if (promptSlugFilter) return `My Library: ${promptSlugFilter}`;
    return "My Library";
  }, [promptSlugFilter]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 text-white">
      {/* Lightbox for Remixes */}
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

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Library</h1>
        <p className="mt-3 text-white/60">
          Your collection of remixes and favorite prompts.
        </p>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-1 border-b border-white/10">
          <button
            onClick={() => setActiveTab("remixes")}
            className={`relative px-6 py-3 text-sm font-medium transition-colors ${activeTab === "remixes" ? "text-[#B7FF00]" : "text-white/60 hover:text-white"
              }`}
          >
            My Remixes
            {activeTab === "remixes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B7FF00]" />}
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`relative px-6 py-3 text-sm font-medium transition-colors ${activeTab === "favorites" ? "text-[#B7FF00]" : "text-white/60 hover:text-white"
              }`}
          >
            Favorites
            {activeTab === "favorites" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B7FF00]" />}
          </button>
        </div>
      </div>

      {activeTab === "remixes" ? (
        // REMIXES GRID
        <section className="min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-white/50">{loading ? "Loading..." : `${remixItems.length} remixes`}</div>
            <div className="flex gap-2">
              {/* Sort Pill could go here */}
            </div>
          </div>

          {errorMsg && <div className="p-4 bg-red-900/20 border border-red-500/20 text-red-200 rounded-xl mb-6">{errorMsg}</div>}

          {!loading && remixItems.length === 0 && (
            <div className="py-20 text-center text-white/40">
              You haven't generated any remixes yet.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {remixItems.map((it) => (
              <div key={it.id} className="relative group rounded-xl bg-white/5 p-2 transition hover:bg-white/10">
                <button
                  className="relative aspect-square w-full overflow-hidden rounded-lg bg-black cursor-pointer"
                  onClick={() => openLightbox(it)}
                >
                  <Image src={it.imageUrl} alt={it.promptTitle} fill className="object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                </button>
                <div className="mt-2 px-1">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-xs font-medium text-white/90 line-clamp-1 truncate" title={it.promptTitle}>{it.promptTitle}</div>
                    <div className="flex items-center gap-1">
                      {/* Favorite Button for Remix */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Toggle favorite for generation
                          // Since we need state for "isFavorited", we might need to fetch it or store it in items.
                          // For now, I will skip implementing the full toggle logic here inside the map 
                          // without a proper component or state.
                          // I will leave this as a placeholder or implement a simple toggle if I can.
                        }}
                        className="text-white/20 hover:text-[#B7FF00] transition hidden"
                      >
                        <Heart className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(it.id); }} className="text-white/20 hover:text-red-400 transition">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    {new Date(it.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        // FAVORITES GRID
        <section className="min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-white/50">{loading ? "Loading..." : `${favoriteItems.length} favorites`}</div>
          </div>

          {errorMsg && <div className="p-4 bg-red-900/20 border border-red-500/20 text-red-200 rounded-xl mb-6">{errorMsg}</div>}

          {!loading && favoriteItems.length === 0 && (
            <div className="py-20 text-center text-white/40">
              You haven't favorited any prompts yet.
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              return null; // Generation favorites not fully implemented UI yet
            })}
          </div>
        </section>
      )}

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
