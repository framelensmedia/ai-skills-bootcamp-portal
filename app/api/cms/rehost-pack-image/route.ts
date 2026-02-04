import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Auth Guard (Staff Only)
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
        const role = profile?.role || "user";
        const isStaff = ["staff", "instructor", "editor", "admin", "super_admin"].includes(role);

        if (!isStaff) {
            return NextResponse.json({ error: "Forbidden: Staff Access Required" }, { status: 403 });
        }

        const body = await req.json();
        const { pack_id, image_url } = body;

        if (!pack_id || !image_url) {
            return NextResponse.json({ error: "Missing pack_id or image_url" }, { status: 400 });
        }

        console.log(`[Rehost Pack] Processing ${pack_id} - ${image_url}`);

        // 2. Download Image (Server-Side)
        const res = await fetch(image_url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            }
        });
        if (!res.ok) throw new Error(`Failed to fetch external image: ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const ext = contentType.split("/")[1] || "jpg";

        // 3. Upload to Supabase Storage
        // Use Service Role to bypass RLS on storage buckets if needed, but here we use authenticated user client
        // Actually, for storage upsert, we might need Service Key if RLS is strict.
        // Let's use the USER client first. If it fails, check policies.
        const path = `packs/cover-${pack_id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("bootcamp-assets")
            .upload(path, buffer, { contentType, upsert: true });

        if (uploadError) {
            throw new Error(`Storage Upload Failed: ${uploadError.message}`);
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from("bootcamp-assets")
            .getPublicUrl(path);

        // 5. Update Pack Record
        const { error: updateError } = await supabase
            .from("template_packs")
            .update({
                thumbnail_url: publicUrl,
            })
            .eq("id", pack_id);

        if (updateError) throw new Error(`DB Update Failed: ${updateError.message}`);

        return NextResponse.json({ success: true, url: publicUrl });

    } catch (error: any) {
        console.error("[Rehost Pack API] Error:", error);
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
