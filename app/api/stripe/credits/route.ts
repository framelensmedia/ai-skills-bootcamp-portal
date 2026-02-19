import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// Credit pack definitions
const CREDIT_PACKS = {
    credits_50: {
        credits: 50,
        priceEnvKey: "STRIPE_CREDITS_50_PRICE_ID",
        name: "50 Credits",
    },
    credits_120: {
        credits: 120,
        priceEnvKey: "STRIPE_CREDITS_120_PRICE_ID",
        name: "120 Credits",
    },
    credits_300: {
        credits: 300,
        priceEnvKey: "STRIPE_CREDITS_300_PRICE_ID",
        name: "300 Credits",
    },
} as const;

type PackId = keyof typeof CREDIT_PACKS;

export async function POST(req: Request) {
    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Parse request body
    let packId: PackId;
    try {
        const body = await req.json();
        packId = body.packId;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate pack ID
    if (!packId || !CREDIT_PACKS[packId]) {
        return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
    }

    const pack = CREDIT_PACKS[packId];
    const priceId = process.env[pack.priceEnvKey];

    if (!priceId) {
        return NextResponse.json({ error: `Missing ${pack.priceEnvKey} environment variable` }, { status: 500 });
    }

    // Get or create Stripe customer
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("stripe_customer_id,email")
        .eq("user_id", user.id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let customerId = (profile?.stripe_customer_id as string | null) ?? null;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email ?? profile?.email ?? undefined,
            metadata: { supabase_user_id: user.id },
        });

        customerId = customer.id;

        await supabase
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", user.id);
    }

    // Detect base URL dynamically to prevent localhost redirects in production
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;

    // Create one-time payment checkout session
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        metadata: {
            supabase_user_id: user.id,
            credits_amount: pack.credits.toString(),
            pack_id: packId,
        },
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        success_url: `${siteUrl}/dashboard?credits_added=${pack.credits}`,
        cancel_url: `${siteUrl}/pricing?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
}
