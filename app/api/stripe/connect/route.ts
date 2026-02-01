import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-10-28.acacia", // Valid stable version for v17
});

export async function POST(req: Request) {
    try {
        // 1. Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authErr } = await admin.auth.getUser(token);

        if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 2. Fetch Ambassador Profile
        const { data: ambassador } = await admin
            .from("ambassadors")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!ambassador) return NextResponse.json({ error: "Ambassador profile not found" }, { status: 404 });

        let accountId = ambassador.stripe_account_id;

        // 3. Create Stripe Account if missing
        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'standard',
                country: 'US', // Default to US or detect? Standard usually asks user. 
                // Actually for 'standard' prompted onboarding, providing country helps but isn't strict.
                email: user.email,
            });
            accountId = account.id;

            // Save to DB
            await admin
                .from("ambassadors")
                .update({ stripe_account_id: accountId, onboarding_step: 3 }) // 3 = Stripe Linked (or in progress)
                .eq("id", ambassador.id);
        }

        // 4. Check details_submitted to see if they are done
        const accountObj = await stripe.accounts.retrieve(accountId);
        if (accountObj.details_submitted) {
            // Already Done: Generate Login Link for Dashboard
            try {
                const loginLink = await stripe.accounts.createLoginLink(accountId);
                return NextResponse.json({ url: loginLink.url, status: "complete" });
            } catch (loginErr) {
                // If login link fails (e.g. platform controls not enabled), fall back to onboarding link
                // Standard accounts claim their own dashboard so login links are valid.
                console.warn("Login link failed:", loginErr);
            }
        }

        // 5. Generate Account Link (Onboarding)
        // Order: Env Var -> Vercel URL -> Request Origin -> Localhost
        let origin = process.env.NEXT_PUBLIC_SITE_URL;

        // Vercel Preview/Production Url Support (auto-https)
        if (!origin && process.env.VERCEL_URL) {
            origin = `https://${process.env.VERCEL_URL}`;
        }

        if (!origin) {
            origin = req.headers.get("origin") || "http://localhost:3000";
        }

        // Remove trailing slash if present
        if (origin.endsWith("/")) origin = origin.slice(0, -1);

        // Warning: Live Mode requires HTTPS
        if (process.env.STRIPE_SECRET_KEY!.startsWith("sk_live") && origin.startsWith("http:")) {
            console.warn("WARNING: Using Stripe Connect Live Mode with HTTP origin. This will likely fail. Please set NEXT_PUBLIC_SITE_URL to an https URL.");
        }

        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/ambassador/onboarding?refresh=true`,
            return_url: `${origin}/ambassador/dashboard?connected=true`,
            type: 'account_onboarding',
        });

        return NextResponse.json({ url: accountLink.url, status: "onboarding" });

    } catch (e: any) {
        console.error("Stripe Connect Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
