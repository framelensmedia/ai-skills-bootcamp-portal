import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer"; // Adjust path if needed
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();

        // 1. Auth Check (Staff+)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Role check (Optional but recommended, though RLS handles it usually)
        // We can assume if they can Update the record, they are staff.

        const body = await req.json();
        const { prompt_id, image_url, title } = body;

        if (!prompt_id || !image_url) {
            return NextResponse.json({ error: "Missing prompt_id or image_url" }, { status: 400 });
        }

        // 2. Fetch Image
        console.log(`[Rehost] Fetching image for prompt ${prompt_id}: ${image_url}`);
        const res = await fetch(image_url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            }
        });
        if (!res.ok) throw new Error(`Failed to fetch external image: ${res.status} ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/png";

        // 3. Upload to Supabase Storage (use Service Role to bypass RLS)
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const filename = `${sanitize(title || "prompt")}-${Date.now()}.png`;
        const path = `prompts/${filename}`;

        const { error: uploadError } = await adminClient.storage
            .from("bootcamp-assets")
            .upload(path, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 4. Update Record
        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bootcamp-assets/${path}`;

        // We use the USER'S supabase client to update the record (respecting RLS)
        const { error: updateError } = await supabase
            .from("prompts")
            .update({
                preview_image_storage_path: path,
                featured_image_url: publicUrl,
                media_type: "image" // Ensure it's marked as image
            })
            .eq("id", prompt_id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, url: publicUrl, path });

    } catch (error: any) {
        console.error(`[Rehost] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function sanitize(str: string) {
    return str.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
}
