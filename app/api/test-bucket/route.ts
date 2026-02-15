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

        return NextResponse.json({
            count: buckets?.length,
            generations_exists: generationsExists,
            buckets: buckets?.map(b => b.name),
            project_url: supabaseUrl // Verify it matches expected
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
