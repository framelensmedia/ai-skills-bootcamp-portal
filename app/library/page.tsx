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

  // Parallel Fetch: Folders & Remixes
  const [foldersRes, remixesRes] = await Promise.all([
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
      .order("created_at", { ascending: false }) // Newest first default
      .limit(200)
  ]);

  const initialFolders = (foldersRes.data || []) as FolderType[];
  const genRows = (remixesRes.data || []) as GenRow[];

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

  const initialRemixItems: LibraryItem[] = genRows.map((g) => {
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

  return (
    <LibraryClient
      initialFolders={initialFolders}
      initialRemixItems={initialRemixItems}
    />
  );
}
