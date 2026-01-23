import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export const alt = "Remix Generation";
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Initialize Supabase Client (Standard)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try prompt_generations first (images)
    const { data: remix } = await supabase
        .from("prompt_generations")
        .select("image_url")
        .eq("id", id)
        .maybeSingle();

    let imageUrl = remix?.image_url;

    // If not found, try video_generations and get source image
    if (!imageUrl) {
        const { data: video } = await supabase
            .from("video_generations")
            .select("source_image_id")
            .eq("id", id)
            .maybeSingle();

        if (video?.source_image_id) {
            // Get the source image for the video thumbnail
            const { data: sourceImage } = await supabase
                .from("prompt_generations")
                .select("image_url")
                .eq("id", video.source_image_id)
                .maybeSingle();

            imageUrl = sourceImage?.image_url;
        }
    }

    // Fallback Image
    if (!imageUrl) {
        return new ImageResponse(
            (
                <div
                    style={{
                        fontSize: 48,
                        background: "black",
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        flexDirection: "column",
                    }}
                >
                    <div style={{ color: "#B7FF00", fontWeight: "bold", marginBottom: 20 }}>AI Skills Studio</div>
                    <div>Remix Not Found</div>
                </div>
            ),
            { ...size }
        );
    }

    // Render Image
    return new ImageResponse(
        (
            <div
                style={{
                    background: "black",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                }}
            >
                {/* Background blurring/gradient for aesthetic */}
                <img
                    src={imageUrl}
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: 0.3,
                        filter: "blur(20px)",
                    }}
                />

                {/* Main Image */}
                <img
                    src={imageUrl}
                    style={{
                        height: "90%",
                        width: "90%",
                        objectFit: "contain",
                        zIndex: 10,
                        borderRadius: 20,
                        boxShadow: "0 0 50px rgba(0,0,0,0.5)",
                    }}
                />

                {/* Optional Branding Overlay */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 30,
                        right: 40,
                        display: "flex",
                        alignItems: "center",
                        zIndex: 20,
                        background: "rgba(0,0,0,0.6)",
                        padding: "10px 20px",
                        borderRadius: 50,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                >
                    <span style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>AI Skills</span>
                    <span style={{ color: "#B7FF00", fontSize: 24, fontWeight: "bold", marginLeft: 8 }}>Studio</span>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
