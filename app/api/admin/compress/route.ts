import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import sharp from "sharp";

export const runtime = "nodejs"; // Required for sharp
export const maxDuration = 300; // 5 minutes

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Ideally check for admin role here
        // For now, we assume authenticated user is okay to run this maintenance 
        // (or you can add a secret key check)

        const { limit = 10, offset = 0 } = await req.json().catch(() => ({}));

        // 1. Fetch candidates (non-webp images)
        const { data: generations, error } = await supabase
            .from("prompt_generations")
            .select("id, user_id, image_url")
            .not("image_url", "like", "%.webp") // Only target non-webp
            .range(offset, offset + limit - 1)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const results = [];

        for (const gen of generations) {
            try {
                // 2. Download Image
                const res = await fetch(gen.image_url);
                if (!res.ok) {
                    results.push({ id: gen.id, status: "failed_download", url: gen.image_url });
                    continue;
                }
                const buffer = await res.arrayBuffer();

                // 3. Compress with Sharp
                // Instagram style: 1080px width, quality 80, WebP
                const optimizedBuffer = await sharp(buffer)
                    .resize({ width: 1080, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();

                // 4. Upload to Supabase
                // New path: users/{userId}/optimized/{id}.webp
                const newPath = `users/${gen.user_id}/optimized/${gen.id}.webp`;

                // Retrieve Service Role client for upload (bypass RLS if needed, though usually owner can upload)
                // We use the same client since we are logged in, but better use Service Role to ensure we can write anywhere if needed.
                // Actually, let's use the authenticated client.
                const { error: uploadError } = await supabase.storage
                    .from("generations")
                    .upload(newPath, optimizedBuffer, {
                        contentType: "image/webp",
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // 5. Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from("generations")
                    .getPublicUrl(newPath);

                // 6. Update Database
                // We must preserve the OLD URL as the "Full Quality" one if it's not already set.
                // Fetch current settings first (or rely on SQL jsonb_set deep merge if possible, but spread is safer)

                // Supabase update with JSONB is tricky. Let's assume we just merging.
                // Actually, `gen.image_url` IS the original right now (before update).

                // Fetch row to get current settings
                const { data: currentRow } = await supabase.from("prompt_generations").select("settings").eq("id", gen.id).single();
                const currentSettings = currentRow?.settings || {};

                // Use the OLD URL (gen.image_url) as full_quality_url
                const newSettings = {
                    ...currentSettings,
                    full_quality_url: currentSettings.full_quality_url || gen.image_url, // Don't overwrite if already set
                };

                const { error: updateError } = await supabase
                    .from("prompt_generations")
                    .update({
                        image_url: publicUrl,
                        settings: newSettings
                    })
                    .eq("id", gen.id);

                if (updateError) throw updateError;

                results.push({ id: gen.id, status: "success", old: gen.image_url, new: publicUrl });
            } catch (err: any) {
                console.error(`Failed to compress ${gen.id}:`, err);
                results.push({ id: gen.id, status: "error", message: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results,
            hasMore: generations.length === limit
        });

    } catch (e: any) {
        console.error("Compression API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
