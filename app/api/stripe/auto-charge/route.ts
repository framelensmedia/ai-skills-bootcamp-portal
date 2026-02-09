import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Credit pack definitions (same as in /api/stripe/credits)
const CREDIT_PACKS = {
    credits_50: { credits: 50, priceEnvKey: "STRIPE_CREDITS_50_PRICE_ID" },
    credits_120: { credits: 120, priceEnvKey: "STRIPE_CREDITS_120_PRICE_ID" },
    credits_300: { credits: 300, priceEnvKey: "STRIPE_CREDITS_300_PRICE_ID" },
} as const;

type PackId = keyof typeof CREDIT_PACKS;

// Internal endpoint - called by generate routes when auto-recharge is triggered
// Should not be called directly by clients
export async function POST(req: Request) {
    // Verify internal call (simple check - can be enhanced with a secret)
    const internalSecret = req.headers.get("x-internal-secret");
    if (internalSecret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { userId, packId } = body;

    if (!userId || !packId) {
        return NextResponse.json({ error: "Missing userId or packId" }, { status: 400 });
    }

    // Validate pack
    if (!CREDIT_PACKS[packId as PackId]) {
        return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
    }

    const pack = CREDIT_PACKS[packId as PackId];
    const priceId = process.env[pack.priceEnvKey];

    if (!priceId) {
        return NextResponse.json({ error: `Missing ${pack.priceEnvKey}` }, { status: 500 });
    }

    try {
        // 1. Get user's Stripe customer ID
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("stripe_customer_id, credits")
            .eq("user_id", userId)
            .single();

        if (profileError || !profile?.stripe_customer_id) {
            console.error("[Auto-Charge] No Stripe customer found for user:", userId);
            return NextResponse.json({ error: "No payment method found" }, { status: 400 });
        }

        const customerId = profile.stripe_customer_id;

        // 2. Get default payment method
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const defaultPaymentMethod = customer.invoice_settings?.default_payment_method as string | null;

        if (!defaultPaymentMethod) {
            // Try to get any payment method
            const paymentMethods = await stripe.paymentMethods.list({
                customer: customerId,
                type: "card",
                limit: 1,
            });

            if (paymentMethods.data.length === 0) {
                console.error("[Auto-Charge] No payment methods for customer:", customerId);
                return NextResponse.json({ error: "No payment method on file" }, { status: 400 });
            }

            // Use the first available payment method
            var paymentMethodId = paymentMethods.data[0].id;
        } else {
            var paymentMethodId = defaultPaymentMethod;
        }

        // 3. Get the price amount from Stripe
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount;

        if (!amount) {
            return NextResponse.json({ error: "Could not determine price" }, { status: 500 });
        }

        // 4. Create and confirm PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            customer: customerId,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
                auto_recharge: "true",
                user_id: userId,
                pack_id: packId,
                credits_amount: pack.credits.toString(),
            },
        });

        if (paymentIntent.status !== "succeeded") {
            console.error("[Auto-Charge] Payment failed:", paymentIntent.status);
            return NextResponse.json({ error: "Payment failed" }, { status: 400 });
        }

        // 5. Add credits to user's account
        const currentCredits = profile.credits ?? 0;
        const newCredits = currentCredits + pack.credits;

        await supabaseAdmin
            .from("profiles")
            .update({
                credits: newCredits,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        console.log(`[Auto-Charge] ✅ Successfully charged ${amount / 100} USD and added ${pack.credits} credits to user ${userId}`);

        return NextResponse.json({
            success: true,
            creditsAdded: pack.credits,
            newBalance: newCredits,
            paymentIntentId: paymentIntent.id,
        });

    } catch (err: any) {
        console.error("[Auto-Charge] Error:", err);

        // Handle specific Stripe errors
        if (err.type === "StripeCardError") {
            // Card was declined - disable auto-recharge
            await supabaseAdmin
                .from("profiles")
                .update({ auto_recharge_enabled: false })
                .eq("user_id", userId);

            return NextResponse.json({
                error: "Card declined. Auto-recharge has been disabled.",
                disabled: true
            }, { status: 400 });
        }

        return NextResponse.json({ error: err.message || "Auto-charge failed" }, { status: 500 });
    }
}
