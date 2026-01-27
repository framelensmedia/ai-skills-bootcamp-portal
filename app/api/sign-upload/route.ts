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
            .createSignedUploadUrl(path);

        if (error) {
            console.error("Sign Error:", error);
            throw error;
        }

        // 5. Get Signed GET URL (for referencing by API)
        // We use createSignedUrl so the API can read it even if the bucket is private.
        const { data: accessData, error: accessError } = await supabaseAdmin
            .storage
            .from("generations")
            .createSignedUrl(path, 60 * 60); // 1 hour

        if (accessError) throw accessError;

        return NextResponse.json({
            signedUrl: data.signedUrl,
            publicUrl: accessData.signedUrl, // naming kept for frontend compatibility
            path: path
        });

    } catch (e: any) {
        console.error("Sign Upload Error:", e);
        return NextResponse.json({ error: e.message || "Failed to sign upload" }, { status: 500 });
    }
}
