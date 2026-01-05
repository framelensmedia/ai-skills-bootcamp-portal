import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

// IMPORTANT: webhook needs raw body
async function readRawBody(req: Request) {
  const arrayBuffer = await req.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Clover typings may not expose current_period_end on Subscription.
 * This helper safely extracts it and returns ISO string or null.
 */
function getCurrentPeriodEndISO(sub: Stripe.Subscription): string | null {
  const cpe = (sub as any)?.current_period_end;
  if (!cpe || typeof cpe !== "number") return null;
  return new Date(cpe * 1000).toISOString();
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Supabase admin client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  try {
    const updateByCustomerId = async (customerId: string, data: any) => {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(data)
        .eq("stripe_customer_id", customerId);

      if (error) throw error;
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription") break;

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // ✅ retrieve() returns the Subscription object directly (no .data)
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });

        const priceId =
          ((sub.items?.data?.[0]?.price as Stripe.Price | undefined)?.id as string | undefined) ??
          null;

        await updateByCustomerId(customerId, {
          plan: "premium",
          stripe_subscription_id: subscriptionId,
          subscription_status: sub.status,
          current_period_end: getCurrentPeriodEndISO(sub),
          price_id: priceId,
          updated_at: new Date().toISOString(),
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items?.data?.[0]?.price?.id ?? null;

        const isActive = sub.status === "active" || sub.status === "trialing";

        await updateByCustomerId(customerId, {
          plan: isActive ? "premium" : "free",
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          current_period_end: getCurrentPeriodEndISO(sub),
          price_id: priceId,
          updated_at: new Date().toISOString(),
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await updateByCustomerId(customerId, {
          plan: "free",
          subscription_status: sub.status,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await updateByCustomerId(customerId, {
          updated_at: new Date().toISOString(),
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Webhook handler failed" }, { status: 500 });
  }
}
