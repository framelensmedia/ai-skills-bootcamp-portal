import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        // 1. Auth & Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authErr } = await admin.auth.getUser(token);

        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Check Pro Status
        const { data: profile } = await admin
            .from("profiles")
            .select("plan, subscription_status")
            .eq("user_id", user.id)
            .single();

        if (!profile || profile.plan !== "premium") {
            return NextResponse.json({
                error: "Must be a Pro member to apply.",
                code: "requires_pro"
            }, { status: 403 });
        }

        // 3. Create or Get Ambassador Record
        // Generate a random referral code if new (simple 8-char string)
        const refCode = Math.random().toString(36).substring(2, 10);

        const { data: ambassador, error: upsertErr } = await admin
            .from("ambassadors")
            .upsert({
                user_id: user.id,
                status: 'pending', // Pending social posts verification
                onboarding_step: 1, // Step 1 complete (Applied)
            }, { onConflict: "user_id" }) // Don't overwrite if exists, just return? 
            // Actually upsert might overwrite referral code if we don't be careful.
            // Better to select first.

            // Let's use select and insert if not exists to be safe about preserving existing data
            .select()
            .maybeSingle();

        // Correct approach: Try to fetch. If missing, insert.
        let result = null;

        const { data: existing } = await admin.from("ambassadors").select("*").eq("user_id", user.id).maybeSingle();

        if (existing) {
            result = existing;
        } else {
            const { data: created, error: createErr } = await admin
                .from("ambassadors")
                .insert({
                    user_id: user.id,
                    status: 'pending',
                    onboarding_step: 1,
                    referral_code: refCode
                })
                .select()
                .single();

            if (createErr) throw createErr;
            result = created;
        }

        return NextResponse.json({ success: true, ambassador: result });

    } catch (e: any) {
        console.error("Ambassador Apply Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
