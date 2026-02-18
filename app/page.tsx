import { createSupabaseServerClient } from "@/lib/supabaseServer";
import HomeFeed, { PublicPrompt } from "./HomeFeed";

export const revalidate = 60; // Cache for 60 seconds (better than force-dynamic)

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // Get user session for favorites
  const { data: { user } } = await supabase.auth.getUser();

  // Parallel fetch: Prompts, Bootcamps, Favorites, and Remixes (Single Query)
  const [promptsRes, bootcampsRes, favRes, remixesRes] = await Promise.all([
    supabase
      .from("prompts_public")
      .select(
        "id, title, slug, summary, category, access_level, created_at, featured_image_url, image_url, media_url"
      )
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("instructor_bootcamps")
      .select("*")
      .eq("status", "coming_soon")
      .order("created_at", { ascending: false }),
    user
      ? supabase.from("prompt_favorites").select("prompt_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),

    // Optimized Remix Fetch: Single query with JOIN, get recent 50 then shuffle
    supabase
      .from("prompt_generations")
      .select(`
           id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text,
           user_id, prompt_id,
           profiles!user_id ( full_name, username, profile_image )
        `)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  const prompts = (promptsRes.data || []) as PublicPrompt[];
  const instructorBootcamps = (bootcampsRes.data || []) as any[];

  // Process & Shuffle Remixes in Memory
  let recentRemixes: any[] = [];
  if (remixesRes.data) {
    const raw = remixesRes.data as any[];
    // Shuffle
    for (let i = raw.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [raw[i], raw[j]] = [raw[j], raw[i]];
    }
    // Slice top 8
    recentRemixes = raw.slice(0, 8).map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles || {};
      const settings = r.settings || {};
      return {
        id: r.id,
        imageUrl: r.image_url,
        title: settings.headline || "Untitled Remix",
        username: profile.full_name || profile.username || "Anonymous Creator",
        userAvatar: profile.profile_image || null,
        upvotesCount: r.upvotes_count || 0,
        originalPromptText: r.original_prompt_text,
        remixPromptText: r.remix_prompt_text,
        combinedPromptText: r.combined_prompt_text,
        createdAt: r.created_at,
        promptId: r.prompt_id || null
      };
    });
  }

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

