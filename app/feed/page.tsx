import { createSupabaseServerClient } from "@/lib/supabaseServer";
import FeedClient, { FeedItem } from "./FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch Generations (Page 0, 8 items, Newest)
    const { data: generations, error } = await supabase
        .from("prompt_generations")
        .select(`
        id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, is_public,
        user_id
    `)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(8);

    if (error || !generations) {
        console.error("Feed fetch error:", error);
        return <FeedClient initialItems={[]} />;
    }

    // 2. Fetch User Profiles
    const userIds = Array.from(new Set(generations.map(d => d.user_id)));
    let profileMap = new Map();
    if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p));
    }

    // 3. Fetch Upvotes & Favorites (if user)
    let myUpvotedSet = new Set<string>();
    let mySavedSet = new Set<string>();

    if (user && generations.length > 0) {
        const genIds = generations.map(d => d.id);

        // Parallel fetch status
        const [upvoteRes, savedRes] = await Promise.all([
            supabase.from("remix_upvotes").select("generation_id").eq("user_id", user.id).in("generation_id", genIds),
            supabase.from("prompt_favorites").select("generation_id").eq("user_id", user.id).in("generation_id", genIds)
        ]);

        if (upvoteRes.data) {
            upvoteRes.data.forEach((u: any) => myUpvotedSet.add(u.generation_id));
        }
        if (savedRes.data) {
            savedRes.data.forEach((u: any) => mySavedSet.add(u.generation_id));
        }
    }

    // 4. Map to FeedItem
    const initialItems: FeedItem[] = generations.map(d => {
        const profile = profileMap.get(d.user_id) || {};
        const settings = d.settings || {};
        const original = d.original_prompt_text || settings.original_prompt_text || "";
        const remix = d.remix_prompt_text || settings.remix_prompt_text || "";
        const combined = d.combined_prompt_text || settings.combined_prompt_text || "";

        return {
            id: d.id,
            imageUrl: d.image_url,
            createdAt: d.created_at,
            upvotesCount: d.upvotes_count || 0,
            isLiked: myUpvotedSet.has(d.id),
            isSaved: mySavedSet.has(d.id),
            userId: d.user_id,
            username: profile.full_name || "Anonymous Creator",
            userAvatar: profile.profile_image || null,
            promptTitle: settings.headline || "Untitled Remix",
            originalPromptText: original,
            remixPromptText: remix,
            combinedPromptText: combined,
            fullQualityUrl: settings.full_quality_url || null,
        };
    });

    return <FeedClient initialItems={initialItems} />;
}
