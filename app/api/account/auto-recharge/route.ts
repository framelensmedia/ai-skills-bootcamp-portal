import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// GET: Fetch user's auto-recharge settings
export async function GET() {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("auto_recharge_enabled, auto_recharge_pack_id, auto_recharge_threshold, credits, stripe_customer_id")
        .eq("user_id", user.id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        enabled: profile?.auto_recharge_enabled ?? false,
        packId: profile?.auto_recharge_pack_id ?? null,
        threshold: profile?.auto_recharge_threshold ?? 10,
        credits: profile?.credits ?? 0,
        hasPaymentMethod: !!profile?.stripe_customer_id,
    });
}

// POST: Update auto-recharge settings
export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { enabled, packId, threshold } = body;

    // Validate packId if enabling
    const validPackIds = ["credits_50", "credits_120", "credits_300"];
    if (enabled && packId && !validPackIds.includes(packId)) {
        return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
    }

    // Check if user has a Stripe customer ID (required for auto-charge)
    if (enabled) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .single();

        if (!profile?.stripe_customer_id) {
            return NextResponse.json({
                error: "You need to make at least one purchase before enabling auto-recharge"
            }, { status: 400 });
        }
    }

    const updateData: any = {};
    if (typeof enabled === "boolean") updateData.auto_recharge_enabled = enabled;
    if (packId) updateData.auto_recharge_pack_id = packId;
    if (typeof threshold === "number" && threshold >= 0) updateData.auto_recharge_threshold = threshold;

    const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...updateData });
}
