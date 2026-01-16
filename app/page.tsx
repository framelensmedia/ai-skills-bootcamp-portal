import { createSupabaseServerClient } from "@/lib/supabaseServer";
import HomeFeed, { PublicPrompt } from "./HomeFeed";

export const dynamic = "force-dynamic"; // Ensure fresh data on every request

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // Get user session for favorites
  const { data: { user } } = await supabase.auth.getUser();

  // Parallel fetch
  const [promptsRes, bootcampsRes, favRes, remixesRes] = await Promise.all([
    supabase
      .from("prompts_public")
      .select(
        "id, title, slug, summary, category, access_level, created_at, featured_image_url, image_url, media_url"
      )
      .order("created_at", { ascending: false })
      .limit(8), // Limit initial fetch as requested
    supabase
      .from("instructor_bootcamps")
      .select("*")
      .eq("status", "coming_soon")
      .order("created_at", { ascending: false }),
    user
      ? supabase.from("prompt_favorites").select("prompt_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("prompt_generations")
      .select(`
         id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text,
         user_id, prompt_id
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  const prompts = (promptsRes.data || []) as PublicPrompt[];
  const instructorBootcamps = (bootcampsRes.data || []) as any[]; // Cast to any to avoid strict type mismatch with client component types if needed

  // Process Remixes
  const rawRemixes = remixesRes.data || [];
  const remixUserIds = Array.from(new Set(rawRemixes.map((r: any) => r.user_id)));

  let profileMap = new Map();
  if (remixUserIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", remixUserIds);
    profiles?.forEach((p: any) => profileMap.set(p.user_id, p));
  }

  const recentRemixes = rawRemixes.map((r: any) => {
    const profile = profileMap.get(r.user_id) || {};
    const settings = r.settings || {};
    return {
      id: r.id,
      imageUrl: r.image_url,
      title: settings.headline || "Untitled Remix",
      username: profile.full_name || "Anonymous Creator",
      userAvatar: profile.profile_image || null,
      upvotesCount: r.upvotes_count || 0,
      originalPromptText: r.original_prompt_text,
      remixPromptText: r.remix_prompt_text,
      combinedPromptText: r.combined_prompt_text,
      createdAt: r.created_at,
      promptId: r.prompt_id || null
    };
  });

  const favoriteIds: string[] = [];
  if (favRes.data) {
    favRes.data.forEach((f: any) => {
      if (f.prompt_id) favoriteIds.push(f.prompt_id);
    });
  }

  return (
    <HomeFeed
      prompts={prompts}
      instructorBootcamps={instructorBootcamps}
      favoriteIds={favoriteIds}
      recentRemixes={recentRemixes}
    />
  );
}
