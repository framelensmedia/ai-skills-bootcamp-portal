import { Metadata, ResolvingMetadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import RemixClient, { RemixDetail } from "./RemixClient";

type Props = {
    params: Promise<{ id: string }>;
};

// 1. Generate Metadata
export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Try prompt_generations first
    let remix = null;
    const { data: imageData } = await supabase
        .from("prompt_generations")
        .select("image_url, settings")
        .eq("id", id)
        .maybeSingle();

    if (imageData) {
        remix = imageData;
    } else {
        // Try video_generations
        const { data: videoData } = await supabase
            .from("video_generations")
            .select("video_url, prompt")
            .eq("id", id)
            .maybeSingle();
        if (videoData) {
            remix = {
                image_url: null,
                video_url: videoData.video_url,
                settings: { headline: videoData.prompt?.slice(0, 50) || "Video" }
            };
        }
    }

    if (!remix) {
        return {
            title: "Remix Not Found",
        };
    }

    const title = remix.settings?.headline || "AI Remix | AI Skills Studio";
    const description = "Check out this AI generation created with AI Skills Studio.";

    return {
        title: title,
        description: description,
        openGraph: {
            title: title,
            description: description,
            images: [`/remix/${id}/opengraph-image`],
            videos: (remix as any).video_url ? [(remix as any).video_url] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: title,
            description: description,
            images: [`/remix/${id}/opengraph-image`],
        },
    };
}

// 2. Server Component Page
export default async function RemixPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Try prompt_generations first (images)
    const { data: remixData } = await supabase
        .from("prompt_generations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    let fullRemixData: RemixDetail | null = null;

    if (remixData) {
        // Image generation found
        const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, profile_image")
            .eq("user_id", remixData.user_id)
            .maybeSingle();

        fullRemixData = {
            ...remixData,
            mediaType: "image",
            profiles: profileData ? {
                full_name: profileData.full_name,
                avatar_url: profileData.profile_image,
                created_at: ""
            } : {
                full_name: "Anonymous Creator",
                avatar_url: null,
                created_at: ""
            }
        };
    } else {
        // Try video_generations
        const { data: videoData } = await supabase
            .from("video_generations")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (videoData) {
            const { data: profileData } = await supabase
                .from("profiles")
                .select("full_name, profile_image")
                .eq("user_id", videoData.user_id)
                .maybeSingle();

            fullRemixData = {
                id: videoData.id,
                image_url: "", // No thumbnail
                video_url: videoData.video_url,
                mediaType: "video",
                created_at: videoData.created_at,
                prompt_slug: null,
                prompt_id: null,
                combined_prompt_text: videoData.prompt,
                user_id: videoData.user_id,
                settings: { headline: videoData.prompt?.slice(0, 50) || "Video" },
                upvotes_count: videoData.upvotes_count || 0,
                profiles: profileData ? {
                    full_name: profileData.full_name,
                    avatar_url: profileData.profile_image,
                    created_at: ""
                } : {
                    full_name: "Anonymous Creator",
                    avatar_url: null,
                    created_at: ""
                }
            };
        }
    }

    if (!fullRemixData) {
        return <RemixClient initialRemix={null} />;
    }

    return <RemixClient key={id} initialRemix={fullRemixData} />;
}

