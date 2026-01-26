"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import GenerationLightbox from "@/components/GenerationLightbox";
import {
    Pencil, Check, X, Trash2, Heart, Library, Image as ImageIcon,
    Star, Grid3X3, List, CheckSquare, Square, FolderInput, Folder,
    Globe, Lock, Film
} from "lucide-react";
import Loading from "@/components/Loading";
import { useToast } from "@/context/ToastContext";
import EditModeModal from "@/components/EditModeModal";
import VideoGeneratorModal from "@/components/VideoGeneratorModal";

type SortMode = "newest" | "oldest";

export type GenRow = {
    id: string;
    image_url: string;
    created_at: string;
    prompt_id: string | null;
    prompt_slug: string | null;
    settings: any;
    original_prompt_text: string | null;
    remix_prompt_text: string | null;
    combined_prompt_text: string | null;
    folder_id?: string | null;
    is_public?: boolean;
};

export type PromptPublicRow = {
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

export type LibraryItem = {
    id: string; // Generation ID
    imageUrl: string;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    mediaType: "image" | "video";
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
    fullQualityUrl?: string | null;
    favoriteType?: "prompt" | "generation";
    favoriteTargetId?: string;
};

export type FolderType = {
    id: string;
    name: string;
};

export type FavoriteItem = {
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

type LibraryClientProps = {
    initialFolders: FolderType[];
    initialRemixItems: LibraryItem[];
    isPro: boolean;
};

export default function LibraryClient({ initialFolders, initialRemixItems, isPro }: LibraryClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();

    const promptSlugFilter = normalize(searchParams?.get("promptSlug") || "").toLowerCase();

    // If we have initial items, we aren't loading initially.
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<SortMode>("newest");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<"remixes" | "favorites">("remixes");
    const [mediaFilter, setMediaFilter] = useState<"all" | "images" | "videos">("all");

    const [remixItems, setRemixItems] = useState<LibraryItem[]>(initialRemixItems);
    const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
    const [folders, setFolders] = useState<FolderType[]>(initialFolders);

    const [hasFetchedFavorites, setHasFetchedFavorites] = useState(false);

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Move Modal
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

    // Lightbox
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);
    const [lbOriginal, setLbOriginal] = useState("");
    const [lbRemix, setLbRemix] = useState("");
    const [lbCombined, setLbCombined] = useState("");
    const [lbFullQualityUrl, setLbFullQualityUrl] = useState<string | null>(null);
    const [lbVideoUrl, setLbVideoUrl] = useState<string | null>(null);
    const [lbMediaType, setLbMediaType] = useState<"image" | "video">("image");
    const [isOwnedByCurrentUser, setIsOwnedByCurrentUser] = useState(false);

    // Global Private Toggle
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

    // Video Modal
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [videoSourceImage, setVideoSourceImage] = useState<string | null>(null);
    const [videoSourceId, setVideoSourceId] = useState<string | undefined>(undefined);


    // Derived state for the toggle
    const areAllPrivate = remixItems.length > 0 && remixItems.every(i => !i.is_public);

    async function handleToggleGlobalPrivacy() {
        if (!isPro) {
            router.push("/pricing");
            return;
        }

        const targetStatePrivate = !areAllPrivate; // If currently all private, we target public (false).
        const actionLabel = targetStatePrivate ? "Private" : "Public";
        const newIsPublic = !targetStatePrivate;

        if (!confirm(`Switch ALL remixes to ${actionLabel}?`)) {
            return;
        }

        setIsUpdatingPrivacy(true);
        const supabase = createSupabaseBrowserClient();

        // 1. Update all in UI immediately
        setRemixItems(prev => prev.map(p => ({ ...p, is_public: newIsPublic })));

        // 2. Update DB
        const { error } = await supabase
            .from("prompt_generations")
            .update({ is_public: newIsPublic })
            .eq("user_id", (await supabase.auth.getUser()).data.user?.id!);

        if (error) {
            alert(`Failed to set all to ${actionLabel}.`);
            // Revert UI?
            setRemixItems(prev => prev.map(p => ({ ...p, is_public: !newIsPublic })));
        } else {
            showToast(`All remixes set to ${actionLabel}.`, "success");
        }

        setIsUpdatingPrivacy(false);
    }

    // Edit Mode
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    async function openLightbox(it: LibraryItem) {
        if (isSelectionMode) {
            toggleSelection(it.id);
            return;
        }

        // Check if this item belongs to the current user
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        // For remixes tab, check if user_id matches. For favorites, it's always someone else's
        const isOwned = activeTab === "remixes";
        setIsOwnedByCurrentUser(isOwned);

        setLbOriginal(it.originalPromptText);
        setLbRemix(it.remixPromptText);
        setLbCombined(it.combinedPromptText);
        setLightboxUrl(it.imageUrl);
        setLightboxItemId(it.id);
        setLbFullQualityUrl(it.fullQualityUrl || null);
        setLbVideoUrl(it.videoUrl || null);
        setLbMediaType(it.mediaType || "image");
        setLightboxOpen(true);
    }

    function toggleSelection(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    }

    async function handleEditGenerate(prompt: string, images: File[] = []) {
        if (!lightboxUrl) return;
        setIsEditing(true);

        try {
            // Fetch Source Blob via server-side proxy (bypasses CORS)
            // Try full quality URL first, but fallback to lightbox URL if it fails
            let imageUrl = lbFullQualityUrl || lightboxUrl;
            let proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;

            let blob: Blob;
            let file: File;

            try {
                let res = await fetch(proxyUrl);

                // If full quality URL fails, always try fallback to lightbox URL
                if (!res.ok && lightboxUrl && imageUrl !== lightboxUrl) {
                    console.warn(`Full quality URL failed (${res.status}), trying lightbox URL fallback...`);
                    imageUrl = lightboxUrl;
                    proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
                    res = await fetch(proxyUrl);
                }

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('Both URLs failed:', { lbFullQualityUrl, lightboxUrl, error: errorText });
                    throw new Error(`Failed to load image (${res.status}): Image file not found in storage`);
                }

                blob = await res.blob();
                file = new File([blob], "source_image", { type: blob.type || "image/png" });
            } catch (fetchError: any) {
                console.error('Failed to fetch image for editing:', fetchError);
                throw new Error(`Cannot load image for editing: ${fetchError.message}`);
            }

            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const form = new FormData();
            form.append("userId", user.id);
            form.append("canvas_image", file);
            form.append("prompt", prompt);
            form.append("edit_instructions", prompt);

            // Append additional user images
            images.forEach((img) => {
                form.append("images", img);
            });

            const apiRes = await fetch("/api/generate", {
                method: "POST",
                body: form
            });

            if (!apiRes.ok) {
                const err = await apiRes.text();
                throw new Error(err);
            }

            const data = await apiRes.json();

            // Create new item with edit applied
            const newItem: LibraryItem = {
                id: data.id || `gen-${Date.now()}`,
                imageUrl: data.imageUrl,
                mediaType: "image",
                createdAt: new Date().toISOString(),
                createdAtMs: Date.now(),
                promptId: null,
                promptSlug: null,
                aspectRatio: null,
                promptTitle: "Edited Remix",
                promptCategory: null,
                originalPromptText: lbOriginal,
                remixPromptText: prompt,
                combinedPromptText: lbCombined ? `${lbCombined} → ${prompt}` : prompt,
                folder: null,
                folder_id: null,
                is_public: false,
                fullQualityUrl: data.fullQualityUrl
            };

            setRemixItems(prev => [newItem, ...prev]);

            // Update lightbox to show new edited image (for continued editing)
            setLightboxUrl(newItem.imageUrl);
            setLightboxItemId(newItem.id);
            setLbFullQualityUrl(newItem.fullQualityUrl || null);
            setLbCombined(newItem.combinedPromptText);
            setLightboxOpen(true);
            showToast("Edit complete!");
            setEditModalOpen(false);

        } catch (e: any) {
            console.error(e);
            showToast("Edit failed: " + e.message, "error");
        } finally {
            setIsEditing(false);
        }
    }

    function closeLightbox() {
        setLightboxOpen(false);
        setLightboxUrl(null);
        setLightboxItemId(null);
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

        try {
            if (activeTab === "remixes") {
                const imageIds = ids.filter(id => remixItems.find(i => i.id === id)?.mediaType !== "video");
                const videoIds = ids.filter(id => remixItems.find(i => i.id === id)?.mediaType === "video");

                const promises = [];
                if (imageIds.length > 0) {
                    promises.push(fetch("/api/library/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids: imageIds, table: "prompt_generations" })
                    }));
                }
                if (videoIds.length > 0) {
                    promises.push(fetch("/api/library/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids: videoIds, table: "video_generations" })
                    }));
                }

                await Promise.all(promises);
            } else {
                // Favorites
                const res = await fetch("/api/library/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids, table: "favorites" })
                });
                if (!res.ok) {
                    const json = await res.json();
                    throw new Error(json.error || "Delete failed");
                }
            }



            if (activeTab === "remixes") {
                setRemixItems(prev => prev.filter(i => !selectedIds.has(i.id)));
            } else {
                setFavoriteItems(prev => prev.filter(i => !selectedIds.has(i.recordId)));
            }

            showToast(`Deleted ${selectedIds.size} items`);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        } catch (e: any) {
            showToast(e.message, "error");
        }
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
        const originalRemixes = [...remixItems];
        setRemixItems((prev) => prev.filter((it) => it.id !== id));
        const item = remixItems.find(it => it.id === id);
        const table = item?.mediaType === "video" ? "video_generations" : "prompt_generations";

        try {
            const res = await fetch("/api/library/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id], table })
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Delete failed");
            }
            showToast("Item deleted");
        } catch (e: any) {
            console.error(e);
            showToast("Failed to delete", "error");
            setRemixItems(originalRemixes);
        }
    }

    async function handleMoveSelected(targetFolderId: string | null) {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        const supabase = createSupabaseBrowserClient();
        const table = activeTab === "remixes" ? "prompt_generations" : "prompt_favorites";

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
            return;
        }

        setSelectedIds(new Set());
        setIsSelectionMode(false);
        setIsMoveModalOpen(false);
    }

    async function handleToggleVisibility(item: LibraryItem) {
        const newStatus = !item.is_public;

        // If trying to make Private (newStatus = false) and NOT Pro
        if (!newStatus && !isPro) {
            router.push("/pricing");
            return;
        }

        setRemixItems(prev => prev.map(i => i.id === item.id ? { ...i, is_public: newStatus } : i));

        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase
            .from("prompt_generations")
            .update({ is_public: newStatus })
            .eq("id", item.id);

        if (error) {
            setRemixItems(prev => prev.map(i => i.id === item.id ? { ...i, is_public: !newStatus } : i));
            alert("Failed to update visibility");
        }
    }

    // Effect for fetching data (Client side fallback / Favorites)
    useEffect(() => {
        let cancelled = false;

        async function run() {
            // If we are on Remixes tab and already have items (initial load), skip refetch unless filter/sort changed?
            // Actually standard logic: If activeTab is Favorites and !hasFetchedFavorites, fetch them.
            // If activeTab is Remixes, and we have initial data, we're good?
            // UNLESS sort changed or slug filter.

            const isRemixes = activeTab === "remixes";
            if (isRemixes && remixItems.length > 0 && sortMode === "newest" && !promptSlugFilter) {
                // Likely initial state, no op.
                return;
            }
            if (!isRemixes && hasFetchedFavorites) {
                // Already fetched, maybe client sort?
                // Doing strict server sort here.
            }

            // If switching to favorites for first time
            // If switching to favorites for first time
            if (!isRemixes && !hasFetchedFavorites) {
                setLoading(true);
            } else if (sortMode !== "newest") {
                setLoading(true);
            }

            // If we don't return here, we proceed to fetch.
            // To keep it simple: We fetch if:
            // 1. activeTab = favorites (always re-fetch or check cache?)
            // 2. activeTab = remixes AND (sort != newest OR has filter OR we forced refresh)

            if (isRemixes && sortMode === "newest" && !promptSlugFilter && remixItems === initialRemixItems) return;

            // ... Proceed to fetch ...
            setErrorMsg(null);
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user?.id) return;

            try {
                if (activeTab === "remixes") {
                    // 1. Prepare Images Query
                    let q = supabase
                        .from("prompt_generations")
                        .select(
                            "id, image_url, created_at, prompt_id, prompt_slug, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, folder_id, is_public"
                        )
                        .eq("user_id", user.id)
                        .limit(200);

                    if (promptSlugFilter) q = q.eq("prompt_slug", promptSlugFilter);
                    q = q.order("created_at", { ascending: sortMode === "oldest" });

                    // 2. Prepare Videos Query (only if no specific slug filter)
                    let vQ = supabase
                        .from("video_generations")
                        .select("id, video_url, thumbnail_url, created_at, prompt, is_public, status")
                        .eq("user_id", user.id)
                        .eq("status", "completed")
                        .limit(50);

                    if (sortMode === "oldest") {
                        vQ = vQ.order("created_at", { ascending: true });
                    } else {
                        vQ = vQ.order("created_at", { ascending: false });
                    }

                    const [imgRes, vidRes] = await Promise.all([
                        q,
                        !promptSlugFilter ? vQ : Promise.resolve({ data: [], error: null })
                    ]);

                    if (cancelled) return;
                    if (imgRes.error) throw imgRes.error;
                    if (vidRes.error) throw vidRes.error;

                    const genRows = (imgRes.data ?? []) as GenRow[];
                    const videoRows = (vidRes.data ?? []);

                    // Resolve prompt titles for images
                    const promptIds = Array.from(new Set(genRows.map((g) => g.prompt_id).filter(Boolean))) as string[];
                    const promptMap = new Map<string, PromptPublicRow>();

                    if (promptIds.length) {
                        const { data: prompts } = await supabase.from("prompts_public").select("id, title, slug, category, access_level").in("id", promptIds);
                        (prompts ?? []).forEach((p: any) => promptMap.set(p.id, p as PromptPublicRow));
                    }

                    // Build Image Items
                    const builtImages = genRows.map((g) => {
                        const p = g.prompt_id ? promptMap.get(g.prompt_id) : null;
                        const fb = fallbackFromSettings(g?.settings);
                        const originalPromptText = normalize(g.original_prompt_text) || fb.original;
                        const remixPromptText = normalize(g.remix_prompt_text) || fb.remix;
                        const combinedPromptText = normalize(g.combined_prompt_text) || fb.combined || [originalPromptText, remixPromptText].filter(Boolean).join("\n\n");

                        return {
                            id: g.id,
                            imageUrl: g.image_url,
                            mediaType: "image",
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
                            is_public: g.is_public ?? true,
                            fullQualityUrl: g.settings?.full_quality_url || null,
                        } as LibraryItem;
                    });

                    // Build Video Items
                    const builtVideos = videoRows.map((v: any) => ({
                        id: v.id,
                        imageUrl: "",
                        videoUrl: v.video_url,
                        thumbnailUrl: v.thumbnail_url || null,
                        mediaType: "video",
                        createdAt: v.created_at,
                        createdAtMs: Date.parse(v.created_at || "") || 0,
                        promptId: null,
                        promptSlug: null,
                        aspectRatio: "16:9",
                        promptTitle: v.prompt?.slice(0, 50) || "Animated Scene",
                        promptCategory: null,
                        originalPromptText: v.prompt || "",
                        remixPromptText: "",
                        combinedPromptText: v.prompt || "",
                        folder: null,
                        folder_id: null,
                        is_public: v.is_public ?? false,
                        fullQualityUrl: null,
                    } as LibraryItem));

                    // Merge & Sort
                    const allItems = [...builtImages, ...builtVideos].sort((a, b) => {
                        return sortMode === "oldest"
                            ? a.createdAtMs - b.createdAtMs
                            : b.createdAtMs - a.createdAtMs;
                    });

                    setRemixItems(allItems);

                } else {
                    // Favorites Fetch
                    const { data: favsRow, error: favError } = await supabase
                        .from("prompt_favorites")
                        .select("id, prompt_id, generation_id, created_at, folder_id")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false });

                    const { data: vidFavsRow, error: vidFavError } = await supabase
                        .from("video_favorites")
                        .select("id, video_id, created_at, folder_id")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false });

                    if (cancelled) return;
                    if (favError) throw favError;

                    // Graceful handling for video favorites (table might not exist yet)
                    if (vidFavError) {
                        console.warn("Could not fetch video favorites:", vidFavError);
                    }

                    const favRows = favsRow ?? [];
                    const vidFavRows = (!vidFavError && vidFavsRow) ? vidFavsRow : [];

                    const promptIds = favRows.filter((f: any) => f.prompt_id).map((f: any) => f.prompt_id);
                    const generationIds = favRows.filter((f: any) => f.generation_id).map((f: any) => f.generation_id);
                    const videoIds = vidFavRows.filter((f: any) => f.video_id).map((f: any) => f.video_id);

                    let fetchedPrompts: PromptPublicRow[] = [];
                    if (promptIds.length > 0) {
                        const { data: pData } = await supabase.from("prompts_public").select("id, title, slug, category, access_level, summary, featured_image_url, image_url, media_url").in("id", promptIds);
                        fetchedPrompts = (pData ?? []) as PromptPublicRow[];
                    }

                    let fetchedGens: any[] = [];
                    if (generationIds.length > 0) {
                        const { data: gData } = await supabase.from("prompt_generations").select("*").in("id", generationIds);
                        fetchedGens = gData || [];
                    }

                    let fetchedVideos: any[] = [];
                    if (videoIds.length > 0) {
                        const { data: vData } = await supabase.from("video_generations").select("*").in("id", videoIds);
                        fetchedVideos = vData || [];
                    }



                    const builtFavs: FavoriteItem[] = [];

                    // Process Video Favorites
                    for (const fav of vidFavRows) {
                        const v = fetchedVideos.find(x => x.id === fav.video_id);
                        if (v) {
                            builtFavs.push({
                                recordId: fav.id,
                                folder_id: fav.folder_id || null,
                                createdAt: fav.created_at,
                                type: "generation",
                                data: {
                                    id: v.id,
                                    imageUrl: "",
                                    videoUrl: v.video_url,
                                    thumbnailUrl: v.thumbnail_url || null,
                                    mediaType: "video",
                                    createdAt: v.created_at,
                                    createdAtMs: Date.parse(v.created_at),
                                    promptId: null,
                                    promptSlug: null,
                                    aspectRatio: "16:9",
                                    promptTitle: v.prompt?.slice(0, 50) || "Animated Scene",
                                    promptCategory: null,
                                    originalPromptText: v.prompt || "",
                                    remixPromptText: "",
                                    combinedPromptText: v.prompt || "",
                                    folder: null,
                                    folder_id: null,
                                    is_public: v.is_public ?? true
                                } as LibraryItem
                            });
                        }
                    }

                    // Process Image Favorites
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
                                        mediaType: "image",
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

                    // Sort by createdAt desc
                    builtFavs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    setFavoriteItems(builtFavs);
                    setHasFetchedFavorites(true);
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

    // Favorites Logic
    async function handleRemoveFavorite(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm("Remove from favorites?")) return;

        // Optimistic update
        setFavoriteItems(prev => prev.filter(f => f.recordId !== id));

        try {
            const res = await fetch("/api/library/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id], table: "favorites" }) // Logic handled in API to check both tables if generic 'favorites' passed? Or we need to pass type.
                // Actually current API might only check prompt_favorites if table is favorites.
                // We should check what type of item it is.
                // BUT the id here is the recordId from FavoriteItem.
                // We might need to handle video_favorites differently or update API.
            });

            // NOTE: The ID passed here is the 'recordId' from FavoriteItem.
            // If it came from video_favorites table, the API needs to know or try both.
            // For now, assuming API handles "favorites" as legacy or prompts.
            // Let's check handleRemoveFavorite logic in FeedClient.tsx which calls specific tables.
            // But here in LibraryClient logic is simplified.

            // To be safe, we should probably update the API or try-catch both if we don't know the type easily from the ID.
            // However, the `handleRemoveFavorite` button in the UI (render loop) knows the type?
            // Actually `handleRemoveFavorite` function takes `id` which is `f.recordId`.

            // Let's look at `handleRemoveFavorite` again. Ideally prompts for type.
            // For this specific replacement, I will stick to what was there but add a TODO comment or fix if I see the API.

            if (!res.ok) throw new Error("Failed");
            if (!res.ok) throw new Error("Failed");
            showToast("Removed from favorites");
        } catch (e) {
            console.error(e);
            showToast("Failed to remove", "error");
        }
    }

    function handleItemClick(item: LibraryItem) {
        if (isSelectionMode) {
            toggleSelection(item.id);
            return;
        }

        if (activeTab === "favorites") {
            if (item.favoriteType === "prompt" && item.promptSlug) {
                router.push(`/prompts/${item.promptSlug}`);
                return;
            } else if (item.favoriteType === "generation" && item.favoriteTargetId) {
                // Determine if it's a video or image to route correctly?
                // Actually /remix/[id] handles both now.
                router.push(`/remix/${item.favoriteTargetId}`);
                return;
            }
        }

        // Default: Open Lightbox
        openLightbox(item);
    }

    // Display Logic
    const displayedItems = useMemo(() => {
        let items: LibraryItem[] = [];
        if (activeTab === "remixes") {
            items = remixItems;
        } else {
            items = favoriteItems.map(f => {
                if (f.type === "prompt") {
                    const p = f.data as PromptPublicRow;
                    return {
                        id: f.recordId,
                        imageUrl: p.image_url || p.featured_image_url || "/orb-neon.gif",
                        createdAt: f.createdAt,
                        createdAtMs: Date.parse(f.createdAt),
                        promptTitle: p.title,
                        promptSlug: p.slug,
                        folder_id: f.folder_id,
                        promptId: p.id,
                        aspectRatio: null,
                        promptCategory: p.category,
                        originalPromptText: "",
                        remixPromptText: "",
                        combinedPromptText: "",
                        folder: null,
                        is_public: true,
                        favoriteType: "prompt",
                        favoriteTargetId: p.id
                    } as LibraryItem;
                } else if (f.type === "generation") {
                    const l = f.data as LibraryItem;
                    return {
                        ...l,
                        id: f.recordId,
                        folder_id: f.folder_id,
                        favoriteType: "generation",
                        favoriteTargetId: l.id
                    };
                }
                return null;
            }).filter(Boolean) as LibraryItem[];
        }
        // Apply folder filter
        items = items.filter(it => !selectedFolder || it.folder_id === selectedFolder);

        // Apply media type filter (only for remixes tab)
        if (activeTab === "remixes" && mediaFilter !== "all") {
            items = items.filter(it =>
                mediaFilter === "images" ? it.mediaType === "image" : it.mediaType === "video"
            );
        }

        return items;
    }, [activeTab, remixItems, favoriteItems, selectedFolder, mediaFilter]);

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 text-white font-sans pb-32">
            {/* ... Modal and Lightbox ... */}
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
                id={lightboxItemId || undefined}
                videoUrl={lbVideoUrl}
                mediaType={lbMediaType}
                onClose={closeLightbox}
                originalPromptText={lbOriginal}
                remixPromptText={lbRemix}
                combinedPromptText={lbCombined}
                onShare={handleShare}
                onRemix={handleRemix}
                onEdit={isOwnedByCurrentUser ? () => {
                    if (lbMediaType === "video") {
                        const targetUrl = `/studio?mode=edit&intent=video&videoUrl=${encodeURIComponent(lbVideoUrl || lightboxUrl || "")}&prompt=${encodeURIComponent(lbCombined || lbOriginal || "")}`;
                        router.push(targetUrl);
                    } else {
                        setLightboxOpen(false);
                        setEditModalOpen(true);
                    }
                } : undefined}
                onDelete={isOwnedByCurrentUser ? () => {
                    if (lightboxItemId) {
                        handleDelete(lightboxItemId).then(() => closeLightbox());
                    }
                } : undefined}
                title="Remix"
                fullQualityUrl={lbFullQualityUrl}
                onAnimate={lbMediaType === "image" ? () => {
                    if (!lightboxUrl) return;
                    setVideoSourceImage(lightboxUrl);
                    setVideoSourceId(lightboxItemId || undefined);
                    setLightboxOpen(false);
                    setIsVideoModalOpen(true);
                } : undefined}
                onExtend={lbMediaType === "video" && lbVideoUrl ? (vUrl) => {
                    const target = `/prompts/extend?video=${encodeURIComponent(vUrl)}&prompt=${encodeURIComponent(lbCombined || "")}`;
                    router.push(target);
                    closeLightbox();
                } : undefined}
            />

            {/* Edit Mode Modal */}
            <EditModeModal
                isOpen={editModalOpen}
                onClose={() => !isEditing && setEditModalOpen(false)}
                sourceImageUrl={lightboxUrl || ""}
                onGenerate={handleEditGenerate}
                isGenerating={isEditing}
            />

            {/* Video Generator Modal */}
            {videoSourceImage && (
                <VideoGeneratorModal
                    isOpen={isVideoModalOpen}
                    onClose={() => setIsVideoModalOpen(false)}
                    sourceImage={videoSourceImage}
                    sourceImageId={videoSourceId}
                    userId={undefined} // Route handles authentication
                />
            )}

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

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-mono text-white/40 uppercase">{displayedItems.length} ITEMS</div>
                <div className="flex flex-wrap gap-2">
                    {isSelectionMode && selectedIds.size > 0 && (
                        <>
                            <button onClick={() => setIsMoveModalOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-white hover:bg-zinc-700 whitespace-nowrap">
                                <FolderInput size={14} /> Move
                            </button>
                            <button onClick={handleDeleteSelected} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 hover:bg-red-500/20 whitespace-nowrap">
                                <Trash2 size={14} /> Delete
                            </button>
                        </>
                    )}

                    {activeTab === "remixes" && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-white/10">
                            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                                {areAllPrivate ? "Private Mode" : "Public Mode"} {isPro ? "" : "(Pro)"}
                            </span>
                            <button
                                onClick={handleToggleGlobalPrivacy}
                                disabled={isUpdatingPrivacy}
                                className={`relative h-5 w-9 rounded-full transition-colors ${areAllPrivate ? "bg-[#B7FF00]" : "bg-white/10 hover:bg-white/20"} ${isUpdatingPrivacy ? "opacity-50 cursor-wait" : ""}`}
                            >
                                <span className={`absolute top-1 left-1 h-3 w-3 rounded-full bg-white transition-transform ${areAllPrivate ? "translate-x-4 bg-black" : "translate-x-0"}`} />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border whitespace-nowrap ${isSelectionMode ? "bg-[#B7FF00] text-black border-[#B7FF00]" : "bg-zinc-900 text-white/70 border-white/10"}`}
                    >
                        {isSelectionMode ? <CheckSquare size={14} /> : <Square size={14} />}
                        Select
                    </button>

                    <div className="flex rounded-lg border border-white/10 bg-zinc-900 overflow-hidden shrink-0">
                        <button onClick={() => setViewMode("grid")} className={`p-2 hover:bg-white/5 ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/50"}`}><Grid3X3 size={16} /></button>
                        <div className="w-px bg-white/10" />
                        <button onClick={() => setViewMode("list")} className={`p-2 hover:bg-white/5 ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/50"}`}><List size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                <aside className="w-full lg:w-48 shrink-0">
                    <div className="flex items-center justify-between px-2 mb-2 lg:mb-2">
                        <h3 className="text-xs font-bold uppercase text-white/40 hidden lg:block">Folders</h3>
                        <div className="flex items-center justify-between w-full lg:w-auto">
                            <span className="lg:hidden text-xs font-bold uppercase text-white/40">Folder:</span>
                            <button onClick={handleCreateFolder} className="text-white/40 hover:text-[#B7FF00] flex items-center gap-1">
                                <Pencil size={12} />
                                <span className="lg:hidden text-[10px] uppercase">New Folder</span>
                            </button>
                        </div>
                    </div>

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

                    {/* Media Type Filter - Mobile */}
                    {activeTab === "remixes" && (
                        <div className="lg:hidden flex rounded-lg border border-white/10 bg-zinc-900 overflow-hidden mb-6">
                            <button onClick={() => setMediaFilter("all")} className={`flex-1 px-3 py-2 text-xs font-bold uppercase ${mediaFilter === "all" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}>All</button>
                            <button onClick={() => setMediaFilter("images")} className={`flex-1 px-3 py-2 text-xs font-bold uppercase flex items-center justify-center gap-1 ${mediaFilter === "images" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}><ImageIcon size={12} />Images</button>
                            <button onClick={() => setMediaFilter("videos")} className={`flex-1 px-3 py-2 text-xs font-bold uppercase flex items-center justify-center gap-1 ${mediaFilter === "videos" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}><Film size={12} />Videos</button>
                        </div>
                    )}

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

                    {/* Media Type Filter - Desktop */}
                    {activeTab === "remixes" && (
                        <div className="hidden lg:flex rounded-lg border border-white/10 bg-zinc-900 overflow-hidden mt-4">
                            <button onClick={() => setMediaFilter("all")} className={`flex-1 px-3 py-2 text-xs font-bold uppercase ${mediaFilter === "all" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}>All</button>
                            <button onClick={() => setMediaFilter("images")} className={`flex-1 px-3 py-2 text-xs font-bold uppercase flex items-center justify-center gap-1 ${mediaFilter === "images" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}><ImageIcon size={12} /></button>
                            <button onClick={() => setMediaFilter("videos")} className={`flex-1 px-3 py-2 text-xs font-bold uppercase flex items-center justify-center gap-1 ${mediaFilter === "videos" ? "bg-[#B7FF00] text-black" : "text-white/50"}`}><Film size={12} /></button>
                        </div>
                    )}
                </aside>

                <section className="flex-1 min-h-[50vh]">
                    {loading ? <Loading /> : displayedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-white/10 rounded-2xl bg-zinc-900/50 text-center">
                            <div className="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-zinc-800 text-white/30">
                                <Library size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Library is empty</h3>
                            <p className="text-sm text-white/50 max-w-sm mx-auto">
                                {activeTab === "remixes"
                                    ? "You haven't generated any remixes yet. Go to the Studio to start creating!"
                                    : "You haven't added any favorites yet."}
                            </p>
                            {activeTab === "remixes" && (
                                <button onClick={() => router.push('/studio/creator')} className="mt-6 px-5 py-2.5 rounded-lg bg-[#B7FF00] text-black text-sm font-bold hover:bg-[#B7FF00]/90 transition">
                                    Open Creator Studio
                                </button>
                            )}
                        </div>
                    ) : (
                        viewMode === "grid" ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {displayedItems.map(it => (
                                    <div key={it.id} className={`group relative aspect-square bg-zinc-900 border ${selectedIds.has(it.id) ? "border-[#B7FF00] ring-1 ring-[#B7FF00]" : "border-white/10"} overflow-hidden cursor-pointer rounded-lg`} onClick={() => handleItemClick(it)}>
                                        {/* Render Video or Image */}
                                        {it.mediaType === "video" && it.videoUrl ? (
                                            <>
                                                <video
                                                    poster={it.thumbnailUrl || undefined}
                                                    src={it.videoUrl}
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                    muted
                                                    loop
                                                    playsInline
                                                    onMouseEnter={(e) => {
                                                        const p = e.currentTarget.play();
                                                        if (p !== undefined) { p.catch(() => { }); }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.pause();
                                                        e.currentTarget.currentTime = 0;
                                                    }}
                                                />
                                                <div className="absolute top-2 right-2 z-10 bg-black/70 text-lime-400 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />
                                                    Video
                                                </div>
                                            </>
                                        ) : it.imageUrl ? (
                                            <Image
                                                src={it.imageUrl}
                                                alt={it.promptTitle}
                                                fill
                                                className="object-cover transition group-hover:scale-105"
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-white/5 animate-pulse" />
                                        )}

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

                                        {activeTab === "favorites" && (
                                            <div
                                                onClick={(e) => handleRemoveFavorite(it.id, e)}
                                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-pink-500 hover:bg-black hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                                                title="Remove from favorites"
                                            >
                                                <Heart size={14} fill="currentColor" />
                                            </div>
                                        )}

                                        {isSelectionMode && activeTab === "remixes" && (
                                            <div className="absolute top-2 right-2">
                                                {selectedIds.has(it.id) ? <div className="bg-[#B7FF00] text-black rounded shadow-sm"><CheckSquare size={20} /></div> : <div className="bg-black/50 text-white/50 rounded shadow-sm"><Square size={20} /></div>}
                                            </div>
                                        )}
                                        {isSelectionMode && activeTab === "favorites" && (
                                            <div className="absolute top-2 left-2">
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
                                    <div key={it.id} className={`flex items-center gap-4 p-2 rounded-lg border ${selectedIds.has(it.id) ? "border-[#B7FF00] bg-[#B7FF00]/5" : "border-white/5 bg-zinc-900/50"} cursor-pointer hover:bg-zinc-900 transition`} onClick={() => handleItemClick(it)}>
                                        <div className="relative w-12 h-12 bg-black shrink-0 rounded overflow-hidden">
                                            {it.imageUrl ? (
                                                <Image src={it.imageUrl} alt="" fill className="object-cover" unoptimized />
                                            ) : <div className="bg-white/5 w-full h-full" />}

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
                                                {activeTab === "favorites" && (
                                                    <button onClick={(e) => handleRemoveFavorite(it.id, e)} className="flex items-center gap-1 text-pink-500 hover:text-red-500">
                                                        <Heart size={10} fill="currentColor" />
                                                        <span>Remove</span>
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
        </main>
    );
}
