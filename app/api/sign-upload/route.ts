import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        // 1. Auth Check
        const supabaseAuth = await createSupabaseServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { filename, fileType } = await req.json();

        if (!filename || !fileType) {
            return NextResponse.json({ error: "Missing filename or fileType" }, { status: 400 });
        }

        // 2. Admin Client for Storage
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 3. Generate Secure Path
        // Store in a temp/scratch folder.
        // Clean filename just in case
        const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `scratch/${user.id}/${Date.now()}_${cleanName}`;

        // 4. Create Signed Upload URL
        const { data, error } = await supabaseAdmin
            .storage
            .from("generations")
            .createSignedUploadUrl(path, { upsert: true });

        if (error) {
            console.error("Sign Error:", error);
            throw error;
        }

        // 5. Get Public URL (for referencing later)
        // Note: For private buckets, this URL is 403 Forbidden to the public.
        // The API must handle this by using the 'path' or detecting the URL pattern.
        const { data: publicData } = supabaseAdmin
            .storage
            .from("generations")
            .getPublicUrl(path);

        return NextResponse.json({
            signedUrl: data.signedUrl,
            publicUrl: publicData.publicUrl,
            path: path
        });

    } catch (e: any) {
        console.error("Sign Upload Error:", e);
        return NextResponse.json({
            error: e.message || "Failed to sign upload",
            details: JSON.stringify(e),
            bucket: "generations"
        }, { status: 500 });
    }
}
