import { createSupabaseServerClient } from "@/lib/supabaseServer";
import HomeFeed, { PublicPrompt } from "./HomeFeed";

export const dynamic = "force-dynamic"; // Ensure fresh data on every request

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // Get user session for favorites
  const { data: { user } } = await supabase.auth.getUser();

  // Parallel fetch
  const [promptsRes, favRes] = await Promise.all([
    supabase
      .from("prompts_public")
      .select(
        "id, title, slug, summary, category, access_level, created_at, featured_image_url, image_url, media_url"
      )
      .order("created_at", { ascending: false })
      .limit(18), // Limit initial fetch as requested
    user
      ? supabase.from("prompt_favorites").select("prompt_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] })
  ]);

  const prompts = (promptsRes.data || []) as PublicPrompt[];

  const favoriteIds: string[] = [];
  if (favRes.data) {
    favRes.data.forEach((f: any) => {
      if (f.prompt_id) favoriteIds.push(f.prompt_id);
    });
  }

  return (
    <HomeFeed prompts={prompts} favoriteIds={favoriteIds} />
  );
}
