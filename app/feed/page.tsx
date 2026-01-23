import { createSupabaseServerClient } from "@/lib/supabaseServer";
import FeedClient, { FeedItem } from "./FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch Image Generations (Page 0, 8 items, Newest)
    const { data: generations, error } = await supabase
        .from("prompt_generations")
        .select(`
        id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, is_public,
        user_id
    `)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(8);

    // 2. Fetch Video Generations
    const { data: videoGenerations } = await supabase
        .from("video_generations")
        .select(`id, video_url, created_at, upvotes_count, prompt, dialogue, is_public, user_id, source_image_id`)
        .eq("is_public", true)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(8);

    if (error || !generations) {
        console.error("Feed fetch error:", error);
        return <FeedClient initialItems={[]} />;
    }

    // 3. Merge and collect user IDs
    const allUserIds = new Set<string>();
    generations.forEach(d => allUserIds.add(d.user_id));
    videoGenerations?.forEach(d => allUserIds.add(d.user_id));

    const userIds = Array.from(allUserIds);
    let profileMap = new Map();
    if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p));
    }

    // 4. Fetch Upvotes & Favorites (if user)
    let myUpvotedSet = new Set<string>();
    let mySavedSet = new Set<string>();

    if (user) {
        const imageIds = generations.map(d => d.id);
        const videoIds = videoGenerations?.map(d => d.id) || [];

        const promises = [
            // Images
            imageIds.length > 0 ? supabase.from("remix_upvotes").select("generation_id").eq("user_id", user.id).in("generation_id", imageIds) : Promise.resolve({ data: [] }),
            imageIds.length > 0 ? supabase.from("prompt_favorites").select("generation_id").eq("user_id", user.id).in("generation_id", imageIds) : Promise.resolve({ data: [] }),
            // Videos
            videoIds.length > 0 ? supabase.from("video_upvotes").select("video_id").eq("user_id", user.id).in("video_id", videoIds) : Promise.resolve({ data: [] }),
            videoIds.length > 0 ? supabase.from("video_favorites").select("video_id").eq("user_id", user.id).in("video_id", videoIds) : Promise.resolve({ data: [] })
        ];

        const [imgUpvotes, imgSaved, vidUpvotes, vidSaved] = await Promise.all(promises);

        imgUpvotes.data?.forEach((u: any) => myUpvotedSet.add(u.generation_id));
        imgSaved.data?.forEach((u: any) => mySavedSet.add(u.generation_id));
        vidUpvotes.data?.forEach((u: any) => myUpvotedSet.add(u.video_id));
        vidSaved.data?.forEach((u: any) => mySavedSet.add(u.video_id));
    }

    // 5. Map Images to FeedItem
    const imageItems: FeedItem[] = generations.map(d => {
        const profile = profileMap.get(d.user_id) || {};
        const settings = d.settings || {};
        const original = d.original_prompt_text || settings.original_prompt_text || "";
        const remix = d.remix_prompt_text || settings.remix_prompt_text || "";
        const combined = d.combined_prompt_text || settings.combined_prompt_text || "";

        return {
            id: d.id,
            imageUrl: d.image_url,
            mediaType: "image" as const,
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

    // 6. Map Videos to FeedItem
    const videoItems: FeedItem[] = (videoGenerations || []).map(d => {
        const profile = profileMap.get(d.user_id) || {};

        return {
            id: d.id,
            imageUrl: "", // Videos don't have a separate thumbnail (could use source_image_id later)
            videoUrl: d.video_url,
            mediaType: "video" as const,
            createdAt: d.created_at,
            upvotesCount: d.upvotes_count || 0,
            isLiked: myUpvotedSet.has(d.id),
            isSaved: mySavedSet.has(d.id),
            userId: d.user_id,
            username: profile.full_name || "Anonymous Creator",
            userAvatar: profile.profile_image || null,
            promptTitle: d.prompt?.slice(0, 50) || "Animated Scene",
            originalPromptText: d.prompt || "",
            remixPromptText: "",
            combinedPromptText: d.prompt || "",
            fullQualityUrl: null,
        };
    });

    // 7. Merge and sort by createdAt
    const allItems = [...imageItems, ...videoItems].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 12); // Limit to 12 initial items

    return <FeedClient initialItems={allItems} />;
}

