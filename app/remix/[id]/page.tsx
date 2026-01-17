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

    const { data: remix } = await supabase
        .from("prompt_generations")
        .select("image_url, settings")
        .eq("id", id)
        .maybeSingle();

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
            images: [`/remix/${id}/opengraph-image`], // Explicitly override layout default
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

    // Fetch Full Data
    const { data: remixData } = await supabase
        .from("prompt_generations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (!remixData) {
        return <RemixClient initialRemix={null} />;
    }

    // Fetch Profile
    const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, profile_image")
        .eq("user_id", remixData.user_id)
        .maybeSingle();

    const fullRemixData: RemixDetail = {
        ...remixData,
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

    return <RemixClient key={id} initialRemix={fullRemixData} />;
}
