import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authErr } = await admin.auth.getUser(token);

        if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Fetch Ambassador Details
        const { data: ambassador } = await admin
            .from("ambassadors")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!ambassador) {
            return NextResponse.json({ error: "Not an ambassador" }, { status: 404 });
        }

        // SELF-HEALING: FIX MISSING REFERRAL CODES
        if (!ambassador.referral_code) {
            const newCode = Math.random().toString(36).substring(2, 10);
            await admin.from("ambassadors").update({ referral_code: newCode }).eq("id", ambassador.id);
            ambassador.referral_code = newCode;
        }

        // JUST-IN-TIME STRIPE SYNC
        // If they are on Step 3 (Stripe Linked), check if they actually finished it.
        // This handles cases where they return from Stripe but the hook/callback didn't fire or redirect logic missed.
        if (ambassador.onboarding_step === 3 && ambassador.stripe_account_id) {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
                apiVersion: "2024-10-28.acacia" as any,
            });

            try {
                const accountObj = await stripe.accounts.retrieve(ambassador.stripe_account_id);
                if (accountObj.details_submitted) {
                    // They are done! Auto-upgrade to Step 4 (Complete)
                    await admin.from("ambassadors").update({ onboarding_step: 4 }).eq("id", ambassador.id);
                    ambassador.onboarding_step = 4; // Update local obj for response
                }
            } catch (err) {
                console.error("Failed to sync stripe status:", err);
            }
        }

        // Fetch Referrals Stats
        const { count: totalReferrals } = await admin
            .from("referrals")
            .select("*", { count: 'exact', head: true })
            .eq("ambassador_id", ambassador.id);

        const { count: activePro } = await admin
            .from("referrals")
            .select("*", { count: 'exact', head: true })
            .eq("ambassador_id", ambassador.id)
            .eq("status", "active_pro");

        const { count: trials } = await admin
            .from("referrals")
            .select("*", { count: 'exact', head: true })
            .eq("ambassador_id", ambassador.id)
            .eq("status", "trial");

        // Fetch Earnings (Commissions)
        // Sum amount where status = paid
        const { data: earnings } = await admin
            .from("commissions")
            .select("amount, status")
            .eq("ambassador_id", ambassador.id);

        const totalEarnedCents = earnings?.reduce((acc, curr) => curr.status === 'paid' ? acc + curr.amount : acc, 0) || 0;
        const pendingCents = earnings?.reduce((acc, curr) => curr.status === 'pending' ? acc + curr.amount : acc, 0) || 0;

        return NextResponse.json({
            ambassador,
            stats: {
                total_referrals: totalReferrals || 0,
                active_pro_members: activePro || 0,
                active_trials: trials || 0,
                total_earned_usd: totalEarnedCents / 100,
                pending_usd: pendingCents / 100,
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
