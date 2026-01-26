import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // FormData needs nodejs runtime usually or edge

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const buffer = await file.arrayBuffer();
        const filename = `scratch/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;

        const { error } = await supabase.storage.from("generations").upload(filename, buffer, {
            contentType: file.type,
            upsert: true
        });

        if (error) {
            throw error;
        }

        const { data } = supabase.storage.from("generations").getPublicUrl(filename);

        return NextResponse.json({ url: data.publicUrl });

    } catch (e: any) {
        console.error("Upload proxy error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
