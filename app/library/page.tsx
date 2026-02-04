import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import LibraryClient, { FolderType, GenRow, LibraryItem, PromptPublicRow } from "./LibraryClient";

export const dynamic = "force-dynamic";

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

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/library");
  }

  // Parallel Fetch: Folders, Remixes, Videos & Profile
  const [foldersRes, remixesRes, videosRes, profileRes] = await Promise.all([
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("prompt_generations")
      .select(
        "id, image_url, created_at, prompt_id, prompt_slug, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, folder_id, is_public"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("video_generations")
      .select("id, video_url, created_at, prompt, dialogue, is_public, source_image_id, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("plan, role, staff_pro")
      .eq("user_id", user.id)
      .single()
  ]);

  const initialFolders = (foldersRes.data || []) as FolderType[];
  const genRows = (remixesRes.data || []) as GenRow[];
  const videoRows = videosRes.data || [];
  const profile = profileRes.data;

  const isPro = (() => {
    if (!profile) return false;
    const plan = String(profile.plan || "free").toLowerCase();
    const role = String(profile.role || "user").toLowerCase();
    const staffPro = Boolean(profile.staff_pro);
    const isStaffPlus = ["staff", "instructor", "editor", "admin", "super_admin"].includes(role);
    return plan === "premium" || staffPro || isStaffPlus;
  })();

  // Hydrate prompts for Remixes
  const promptIds = Array.from(new Set(genRows.map((g) => g.prompt_id).filter(Boolean))) as string[];
  const promptMap = new Map<string, PromptPublicRow>();

  if (promptIds.length > 0) {
    const { data: prompts } = await supabase
      .from("prompts_public")
      .select("id, title, slug, category, access_level")
      .in("id", promptIds);

    (prompts || []).forEach((p: any) => promptMap.set(p.id, p));
  }

  // Map Images to LibraryItem
  const imageItems: LibraryItem[] = genRows.map((g) => {
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
      mediaType: "image" as const,
      createdAt: g.created_at,
      createdAtMs: Date.parse(g.created_at || "") || 0,
      promptId: g.prompt_id,
      promptSlug: g.prompt_slug,
      aspectRatio: g?.settings?.aspectRatio ?? null,
      promptTitle: g.settings?.headline || p?.title || g.prompt_slug || "Untitled Remix",
      promptCategory: p?.category || null,
      originalPromptText,
      remixPromptText,
      combinedPromptText,
      folder: fb.folder,
      folder_id: (g as any).folder_id || null,
      is_public: g.is_public ?? true,
      fullQualityUrl: g.settings?.full_quality_url || null,
    };
  });

  // Map Videos to LibraryItem
  const videoItems: LibraryItem[] = videoRows.map((v: any) => {
    return {
      id: v.id,
      imageUrl: "", // No thumbnail for now
      videoUrl: v.video_url,
      mediaType: "video" as const,
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
    };
  });

  // Merge and sort by createdAtMs
  const initialRemixItems = [...imageItems, ...videoItems].sort(
    (a, b) => b.createdAtMs - a.createdAtMs
  );

  return (
    <LibraryClient
      initialFolders={initialFolders}
      initialRemixItems={initialRemixItems}
      isPro={isPro}
    />
  );
}

