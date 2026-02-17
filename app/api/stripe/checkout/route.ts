import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST() {
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

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, plan, subscription_status")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check for active subscription
  const isActive =
    profile?.plan === "premium" ||
    profile?.plan === "staff_pro" ||
    profile?.plan === "admin" ||
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "trialing";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aiskills.studio";

  if (isActive && profile?.stripe_customer_id) {
    // Create Portal Session instead
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl}/dashboard`,
    });
    return NextResponse.json({ url: portalSession.url });
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

  const { data: referral } = await supabase
    .from("referrals")
    .select("ambassador_id")
    .eq("referred_user_id", user.id)
    .maybeSingle();

  // Also check cookie as fallback
  let ambassadorId = referral?.ambassador_id;
  if (!ambassadorId) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const refCode = cookieStore.get("ref_code")?.value;
    if (refCode) {
      const { data: amb } = await supabase.from("ambassadors").select("id").eq("referral_code", refCode).maybeSingle();
      if (amb) ambassadorId = amb.id;
    }
  }



  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    metadata: {
      supabase_user_id: user.id,
      ambassador_id: ambassadorId || null
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: "7-Day Trial Access",
            description: "Instant access for 7 days",
          },
          unit_amount: 100, // $1.00
        },
      },
    ],
    subscription_data: {
      trial_period_days: 7,
    },
    success_url: `${siteUrl}/dashboard?paid=1`,
    cancel_url: `${siteUrl}/pricing?canceled=1`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
