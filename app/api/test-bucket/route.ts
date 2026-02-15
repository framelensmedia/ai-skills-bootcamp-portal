import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseUrl || !serviceRole) {
            return NextResponse.json({ error: "Missing Envs", supabaseUrl: !!supabaseUrl, serviceRole: !!serviceRole }, { status: 500 });
        }

        const admin = createClient(supabaseUrl, serviceRole);

        // List Buckets
        const { data: buckets, error } = await admin.storage.listBuckets();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const generationsExists = buckets?.some(b => b.name === "generations");
        const remixExists = buckets?.some(b => b.name === "remix-images");
        const identitiesExists = buckets?.some(b => b.name === "identities");
        const workspaceExists = buckets?.some(b => b.name === "workspace_assets");

        return NextResponse.json({
            count: buckets?.length,
            buckets: buckets?.map(b => b.name),
            status: {
                generations: generationsExists,
                remix_images: remixExists,
                identities: identitiesExists,
                workspace_assets: workspaceExists
            },
            project_url: supabaseUrl
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
