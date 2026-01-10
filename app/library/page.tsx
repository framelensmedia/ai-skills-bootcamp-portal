"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import GenerationLightbox from "@/components/GenerationLightbox";
import PromptCard from "@/components/PromptCard";
import {
  Pencil, Check, X, Trash2, Heart, Library, Image as ImageIcon,
  Star, Grid3X3, List, CheckSquare, Square, FolderInput, Folder,
  Globe, Lock
} from "lucide-react";
import Link from "next/link";
import Loading from "@/components/Loading";

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
  folder_id?: string | null;
  is_public?: boolean;
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
  folder: string | null;
  folder_id: string | null;
  is_public: boolean;
};

type FolderType = {
  id: string;
  name: string;
};

type FavoriteItem = {
  recordId: string;
  folder_id: string | null;
  createdAt: string;
  type: "prompt" | "generation";
  data: PromptPublicRow | LibraryItem;
};

function normalize(v: any) {
  return String(v ?? "").trim();
}

function fallbackFromSettings(settings: any) {
  const s = settings || {};

  const original = normalize(s?.original_prompt_text) || "";

  const remix = normalize(s?.remix_prompt_text) || "";

  const combined = normalize(s?.combined_prompt_text) || "";

  return { original, remix, combined, folder: normalize(s?.folder) || null };
}

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const promptSlugFilter = normalize(searchParams?.get("promptSlug") || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // "remixes" = My Generations (prompt_generations)
  // "favorites" = My Favorites (prompt_favorites -> prompts_public / prompt_generations)
  const [activeTab, setActiveTab] = useState<"remixes" | "favorites">("remixes");

  const [remixItems, setRemixItems] = useState<LibraryItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);

  // Selection Mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Move Modal
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lbOriginal, setLbOriginal] = useState("");
  const [lbRemix, setLbRemix] = useState("");
  const [lbCombined, setLbCombined] = useState("");

  function openLightbox(it: LibraryItem) {
    if (isSelectionMode) {
      toggleSelection(it.id);
      return;
    }
    setLbOriginal(it.originalPromptText);
    setLbRemix(it.remixPromptText);
    setLbCombined(it.combinedPromptText);
    setLightboxUrl(it.imageUrl);
    setLightboxOpen(true);
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxUrl(null);
  }

  function handleShare(url: string) {
    console.log("Share clicked:", url);
  }

  async function handleCreateFolder() {
    const name = window.prompt("Enter new folder name:");
    if (!name || !name.trim()) return;

    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("folders").insert({
      name: name.trim(),
      user_id: user.id
    }).select().single();

    if (error) {
      alert("Failed to create folder: " + error.message);
      return;
    }

    if (data) {
      setFolders(prev => [...prev, data as FolderType].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }

  async function handleRenameFolder(id: string, currentName: string) {
    const name = window.prompt("Rename folder:", currentName);
    if (!name || !name.trim() || name === currentName) return;

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("folders").update({ name: name.trim() }).eq("id", id);

    if (error) {
      alert("Rename failed: " + error.message);
      return;
    }

    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: name.trim() } : f).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Delete this folder? Items inside will remain in your library.")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    setFolders(prev => prev.filter(f => f.id !== id));
    if (selectedFolder === id) setSelectedFolder(null);
  }



  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} items permanently?`)) return;

    const ids = Array.from(selectedIds);
    const supabase = createSupabaseBrowserClient();
    const table = activeTab === "remixes" ? "prompt_generations" : "prompt_favorites";

    const { error } = await supabase.from(table).delete().in("id", ids);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }

    if (activeTab === "remixes") {
      setRemixItems(prev => prev.filter(i => !selectedIds.has(i.id)));
    } else {
      setFavoriteItems(prev => prev.filter(i => !selectedIds.has(i.recordId)));
    }

    setSelectedIds(new Set());
    setIsSelectionMode(false);
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

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this image?")) return;
    setRemixItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/library?id=${id}`, { method: "DELETE" }).catch(console.error);
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

      // Fetch Folders
      try {
        const { data: folderData } = await supabase
          .from("folders")
          .select("*")
          .eq("user_id", user.id)
          .order("name");

        if (folderData && !cancelled) {
          setFolders(folderData as FolderType[]);
        }
      } catch (e) {
        // ignore missing table
      }

      try {
        if (activeTab === "remixes") {
          // Fetch Remixes (prompt_generations)
          let q = supabase
            .from("prompt_generations")
            .select(
              "id, image_url, created_at, prompt_id, prompt_slug, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, folder_id, is_public"
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
              folder: fb.folder,
              folder_id: (g as any).folder_id || null,
              is_public: g.is_public ?? true, // Default to true if null (legacy)
            } as LibraryItem;
          });

          setRemixItems(built);

        } else {
          // Fetch Favorites
          const {
            data: favsRow,
            error: favError
          } = await supabase
            .from("prompt_favorites")
            .select("id, prompt_id, generation_id, created_at, folder_id")
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false
            });

          if (cancelled) return;
          if (favError) throw favError;

          const favRows = favsRow ?? [];
          const promptIds = favRows.filter(f => f.prompt_id).map(f => f.prompt_id);
          const generationIds = favRows.filter(f => f.generation_id).map(f => f.generation_id);

          let fetchedPrompts: PromptPublicRow[] = [];
          if (promptIds.length > 0) {
            const {
              data: pData
            } = await supabase
              .from("prompts_public")
              .select("id, title, slug, category, access_level, summary, featured_image_url, image_url, media_url")
              .in("id", promptIds);
            fetchedPrompts = (pData ?? []) as PromptPublicRow[];
          }

          let fetchedGens: any[] = [];
          if (generationIds.length > 0) {
            const { data: gData } = await supabase.from("prompt_generations").select("*").in("id", generationIds);
            fetchedGens = gData || [];
          }

          const builtFavs: FavoriteItem[] = [];
          for (const fav of favRows) {
            if (fav.prompt_id) {
              const p = fetchedPrompts.find(x => x.id === fav.prompt_id);
              if (p) {
                builtFavs.push({
                  recordId: fav.id,
                  folder_id: fav.folder_id || null,
                  createdAt: fav.created_at,
                  type: "prompt",
                  data: p
                });
              }
            } else if (fav.generation_id) {
              const g = fetchedGens.find(x => x.id === fav.generation_id);
              if (g) {
                builtFavs.push({
                  recordId: fav.id,
                  folder_id: fav.folder_id || null,
                  createdAt: fav.created_at,
                  type: "generation",
                  data: {
                    id: g.id,
                    imageUrl: g.image_url,
                    createdAt: g.created_at,
                    createdAtMs: Date.parse(g.created_at),
                    promptId: g.prompt_id,
                    promptSlug: g.prompt_slug,
                    aspectRatio: g.settings?.aspectRatio ?? null,
                    promptTitle: g.settings?.headline || "Untitled Saved Remix",
                    promptCategory: null,
                    originalPromptText: g.original_prompt_text || "",
                    remixPromptText: g.remix_prompt_text || "",
                    combinedPromptText: g.combined_prompt_text || "",
                    folder: null,
                    folder_id: null,
                    is_public: g.is_public ?? true
                  } as LibraryItem
                });
              }
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

  const displayedItems = useMemo(() => {
    let items: LibraryItem[] = [];
    if (activeTab === "remixes") {
      items = remixItems;
    } else {
      // Map favorites to LibraryItem-like structure
      items = favoriteItems.map(f => {
        if (f.type === "prompt") {
          const p = f.data as PromptPublicRow;
          return {
            id: f.recordId, // Use favorite record ID for selection/moving
            imageUrl: p.image_url || p.featured_image_url || "/orb-neon.gif",
            createdAt: f.createdAt,
            createdAtMs: Date.parse(f.createdAt),
            promptTitle: p.title,
            promptSlug: p.slug,
            folder_id: f.folder_id,
            // Favorites don't have generation-specific fields
            promptId: p.id,
            aspectRatio: null,
            promptCategory: p.category,
            originalPromptText: "",
            remixPromptText: "",
            combinedPromptText: "",
            folder: null,
            is_public: true
          } as LibraryItem;
        } else if (f.type === "generation") {
          const l = f.data as LibraryItem;
          return {
            ...l,
            id: f.recordId, // Vital for selection
            folder_id: f.folder_id,
          };
        }
        return null;
      }).filter(Boolean) as LibraryItem[];
    }

    return items.filter(it => !selectedFolder || it.folder_id === selectedFolder);
  }, [activeTab, remixItems, favoriteItems, selectedFolder]);

  async function handleMoveSelected(targetFolderId: string | null) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const supabase = createSupabaseBrowserClient();
    const table = activeTab === "remixes" ? "prompt_generations" : "prompt_favorites";

    // For prompt_favorites, we update by 'id' (PK) which we mapped to 'id' in displayedItems.
    // prompt_generations also uses 'id'.

    // Optimistic update
    const updateLocal = (folderId: string | null) => {
      if (activeTab === "remixes") {
        setRemixItems(prev => prev.map(item => selectedIds.has(item.id) ? { ...item, folder_id: folderId } : item));
      } else {
        setFavoriteItems(prev => prev.map(item => selectedIds.has(item.recordId) ? { ...item, folder_id: folderId } : item));
      }
    };

    updateLocal(targetFolderId);

    const { error } = await supabase
      .from(table)
      .update({ folder_id: targetFolderId })
      .in("id", ids);

    if (error) {
      alert("Failed to move items: " + error.message);
      // Revert optimistic? 
      // For now, simple alert.
      return;
    }

    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setIsMoveModalOpen(false);
  }

  async function handleToggleVisibility(item: LibraryItem) {
    // Optimistic
    const newStatus = !item.is_public;
    setRemixItems(prev => prev.map(i => i.id === item.id ? { ...i, is_public: newStatus } : i));

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("prompt_generations")
      .update({ is_public: newStatus })
      .eq("id", item.id);

    if (error) {
      // Revert
      setRemixItems(prev => prev.map(i => i.id === item.id ? { ...i, is_public: !newStatus } : i));
      alert("Failed to update visibility");
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white font-sans pb-32">
      {/* Modal for Moving Items */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white">Move {selectedIds.size} items</h3>
              <button onClick={() => setIsMoveModalOpen(false)}><X size={20} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              <button onClick={() => handleMoveSelected(null)} className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 text-white/70 hover:text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center"><Library size={16} /></div>
                <span>Main Library (No Folder)</span>
              </button>
              {folders.map(f => (
                <button key={f.id} onClick={() => handleMoveSelected(f.id)} className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 text-white/70 hover:text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#B7FF00]/10 flex items-center justify-center text-[#B7FF00]"><Folder size={16} /></div>
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <GenerationLightbox
        open={lightboxOpen}
        url={lightboxUrl}
        onClose={closeLightbox}
        originalPromptText={lbOriginal}
        remixPromptText={lbRemix}
        combinedPromptText={lbCombined}
        onShare={handleShare}
        onRemix={handleRemix}
        title="Remix"
      />

      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">My Library</h1>
          <div className="flex items-center gap-2 text-sm text-white/50 font-mono uppercase tracking-wide">
            <span className={selectedFolder ? "text-white/30" : "text-[#B7FF00]"}>{activeTab === "remixes" ? "Remixes" : "Favorites"}</span>
            {selectedFolder && (
              <>
                <span className="text-white/30">/</span>
                <span className="text-[#B7FF00]">{folders.find(f => f.id === selectedFolder)?.name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex bg-zinc-900 p-1 rounded-lg self-start">
          <button onClick={() => { setActiveTab("remixes"); setSelectedFolder(null); }} className={`px-4 py-1.5 text-xs font-bold uppercase rounded ${activeTab === "remixes" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}>Remixes</button>
          <button onClick={() => { setActiveTab("favorites"); setSelectedFolder(null); }} className={`px-4 py-1.5 text-xs font-bold uppercase rounded ${activeTab === "favorites" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}>Favorites</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-xs font-mono text-white/40 uppercase">{displayedItems.length} ITEMS</div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border ${isSelectionMode ? "bg-[#B7FF00] text-black border-[#B7FF00]" : "bg-zinc-900 text-white/70 border-white/10"}`}
          >
            {isSelectionMode ? <CheckSquare size={14} /> : <Square size={14} />}
            Select
          </button>
          <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg border ${viewMode === "grid" ? "border-white/20 bg-white/10" : "border-white/10 bg-zinc-900 text-white/50"}`}><Grid3X3 size={16} /></button>
          <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg border ${viewMode === "list" ? "border-white/20 bg-white/10" : "border-white/10 bg-zinc-900 text-white/50"}`}><List size={16} /></button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar / Mobile Dropdown */}
        <aside className="w-full lg:w-48 shrink-0">
          <div className="flex items-center justify-between px-2 mb-2 lg:mb-2">
            <h3 className="text-xs font-bold uppercase text-white/40 hidden lg:block">Folders</h3>
            {/* Mobile Folder Label is integrated into the dropdown trigger or breadcrumb, so we just show the create button relative */}
            <div className="flex items-center justify-between w-full lg:w-auto">
              <span className="lg:hidden text-xs font-bold uppercase text-white/40">Folder:</span>
              <button onClick={handleCreateFolder} className="text-white/40 hover:text-[#B7FF00] flex items-center gap-1">
                <Pencil size={12} />
                <span className="lg:hidden text-[10px] uppercase">New Folder</span>
              </button>
            </div>
          </div>

          {/* Mobile Dropdown */}
          <div className="lg:hidden relative mb-6">
            <select
              value={selectedFolder || ""}
              onChange={(e) => setSelectedFolder(e.target.value || null)}
              className="w-full bg-zinc-900 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 appearance-none focus:border-[#B7FF00] focus:outline-none"
            >
              <option value="">All {activeTab === "remixes" ? "Remixes" : "Favorites"}</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({activeTab === "remixes" ? remixItems.filter(i => i.folder_id === f.id).length : favoriteItems.filter(i => i.folder_id === f.id).length})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
              <Folder size={14} />
            </div>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden lg:block space-y-1">
            <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-3 py-2 rounded text-sm mb-1 ${!selectedFolder ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>All {activeTab === "remixes" ? "Remixes" : "Favorites"}</button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFolder(f.id)}
                className={`group/folder flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${selectedFolder === f.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="truncate">{f.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-50">
                    {activeTab === "remixes"
                      ? remixItems.filter(i => i.folder_id === f.id).length
                      : favoriteItems.filter(i => i.folder_id === f.id).length
                    }
                  </span>
                  <div className="flex items-center gap-1 transition">
                    <div
                      onClick={(e) => { e.stopPropagation(); handleRenameFolder(f.id, f.name); }}
                      className="text-white/20 hover:text-white p-1"
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }}
                      className="text-white/20 hover:text-red-400 p-1"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Content */}
        <section className="flex-1 min-h-[50vh]">
          {loading ? <Loading /> : (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedItems.map(it => (
                  <div key={it.id} className={`group relative aspect-square bg-zinc-900 border ${selectedIds.has(it.id) ? "border-[#B7FF00] ring-1 ring-[#B7FF00]" : "border-white/10"} overflow-hidden cursor-pointer rounded-lg`} onClick={() => openLightbox(it)}>
                    <Image src={it.imageUrl} alt={it.promptTitle} fill className="object-cover transition group-hover:scale-105" />

                    {/* Visibility Badge (Top Left) */}
                    {activeTab === "remixes" && (
                      <div
                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(it); }}
                        className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 cursor-pointer transition ${it.is_public ? "bg-white/90 text-black hover:bg-white" : "bg-black/60 text-white/70 hover:bg-black/80 backdrop-blur-md"}`}
                        title={it.is_public ? "Public: Visible in Feed" : "Private: Only you can see this"}
                      >
                        {it.is_public ? <Globe size={9} /> : <Lock size={9} />}
                        <span className="hidden group-hover:block">{it.is_public ? "Public" : "Private"}</span>
                      </div>
                    )}

                    {isSelectionMode && (
                      <div className="absolute top-2 right-2">
                        {selectedIds.has(it.id) ? <div className="bg-[#B7FF00] text-black rounded shadow-sm"><CheckSquare size={20} /></div> : <div className="bg-black/50 text-white/50 rounded shadow-sm"><Square size={20} /></div>}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs font-medium text-white truncate">{it.promptTitle}</div>
                      <div className="text-[10px] text-white/50">{new Date(it.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {displayedItems.map(it => (
                  <div key={it.id} className={`flex items-center gap-4 p-2 rounded-lg border ${selectedIds.has(it.id) ? "border-[#B7FF00] bg-[#B7FF00]/5" : "border-white/5 bg-zinc-900/50"} cursor-pointer hover:bg-zinc-900 transition`} onClick={() => openLightbox(it)}>
                    <div className="relative w-12 h-12 bg-black shrink-0 rounded overflow-hidden">
                      <Image src={it.imageUrl} alt="" fill className="object-cover" />
                      {isSelectionMode && selectedIds.has(it.id) && <div className="absolute inset-0 bg-[#B7FF00]/20 flex items-center justify-center"><Check size={16} className="text-[#B7FF00]" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{it.promptTitle}</div>
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        <span>{new Date(it.createdAt).toLocaleDateString()}</span>
                        {activeTab === "remixes" && (
                          <button onClick={(e) => { e.stopPropagation(); handleToggleVisibility(it); }} className={`flex items-center gap-1 hover:text-white ${it.is_public ? "text-green-400" : ""}`}>
                            {it.is_public ? <Globe size={10} /> : <Lock size={10} />}
                            <span>{it.is_public ? "Public" : "Private"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      </div>

      {/* Mobile Sticky Bottom Bar for Selection Actions */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-[#B7FF00] text-black p-3 rounded-full shadow-2xl z-50 flex items-center justify-between px-6 animate-in slide-in-from-bottom-4">
          <div className="text-xs font-bold uppercase tracking-wider">{selectedIds.size} SELECTED</div>
          <div className="flex gap-4">
            <button onClick={() => setIsMoveModalOpen(true)} className="flex flex-col items-center gap-0.5 hover:opacity-70 transition">
              <FolderInput size={20} />
              <span className="text-[9px] font-bold uppercase">Move</span>
            </button>
            <button onClick={handleDeleteSelected} className="flex flex-col items-center gap-0.5 hover:opacity-70 transition text-red-900">
              <Trash2 size={20} />
              <span className="text-[9px] font-bold uppercase">Delete</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryContent />
    </Suspense>
  );
}
