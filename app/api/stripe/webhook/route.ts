import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Initialize inside handler to avoid build errors if env is missing
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-10-28.acacia" as any,
  });
}

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
  const stripe = getStripe();
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
    const updateProfile = async (session: Stripe.Checkout.Session | Stripe.Subscription, data: any) => {
      const customerId = session.customer as string;
      // Try to find user by metadata first (most reliable)
      const supabaseUserId = (session as any).metadata?.supabase_user_id;

      if (supabaseUserId) {
        console.log(`Webhook: Updating profile for user ${supabaseUserId} (from metadata). Data:`, JSON.stringify(data));
        // Ensure stripe_customer_id is set
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ ...data, stripe_customer_id: customerId }) // Sync ID too
          .eq("user_id", supabaseUserId);

        if (!error) {
          console.log(`Webhook: Successfully updated profile for user ${supabaseUserId}`);
          return;
        }
        console.error("Webhook: Failed to update by user_id, falling back to customer_id", error);
      } else {
        console.log("Webhook: No supabase_user_id in metadata. Attempting fallback to stripe_customer_id.");
      }

      // Fallback: Update by stripe_customer_id
      console.log(`Webhook: Updating profile for customer ${customerId}`);
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(data)
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.error(`Webhook: Failed to update profile for customer ${customerId}`, error);
        throw error;
      } else {
        console.log(`Webhook: Successfully updated profile for customer ${customerId}`);
      }
    };

    const processCommission = async (customerId: string, amountPaidCents: number, type: 'trial_bonus' | 'monthly_recurring', eventId: string) => {
      // 1. Find profile to get User ID
      const { data: profile } = await supabaseAdmin.from("profiles").select("user_id").eq("stripe_customer_id", customerId).single();
      if (!profile) return;

      // 2. Find Referral
      const { data: referral } = await supabaseAdmin.from("referrals").select("id, ambassador_id").eq("referred_user_id", profile.user_id).single();
      if (!referral) return;

      // 3. Find Ambassador to get Stripe Account AND Valid Plan
      const { data: ambassador } = await supabaseAdmin.from("ambassadors").select("stripe_account_id, user_id").eq("id", referral.ambassador_id).single();
      if (!ambassador || !ambassador.stripe_account_id) return;

      // 3b. Verify Ambassador is PRO (Premium)
      // "you have to be pro account to get revenue share"
      const { data: ambassadorProfile } = await supabaseAdmin
        .from("profiles")
        .select("plan")
        .eq("user_id", ambassador.user_id)
        .single();

      const isEligible = ambassadorProfile && (ambassadorProfile.plan === 'premium' || ambassadorProfile.plan === 'staff_pro' || ambassadorProfile.plan === 'admin'); // Safe to assume staff/admin also get it? Usually yes, or strict 'premium'
      // Strict check as per user request: "pro account"
      if (ambassadorProfile?.plan !== 'premium' && ambassadorProfile?.plan !== 'staff_pro') {
        console.log(`Commission Skipped for Ambassador ${referral.ambassador_id}: Plan is ${ambassadorProfile?.plan}`);

        await supabaseAdmin.from("commissions").insert({
          ambassador_id: referral.ambassador_id,
          referral_id: referral.id,
          amount: 0,
          type: type,
          status: "ineligible", // Track that they missed it
          metadata: { reason: "Ambassador not on Pro plan" }
        });
        return;
      }

      // 4. Calculate Commission Amount (Active Pro = $10 (1000 cents), Trial = $0.50 (50 cents))
      // Logic: passed in via arguments to keep this generic
      const commissionAmount = type === 'trial_bonus' ? 50 : 1000;

      // 5. Create Transfer
      // Use transfer_group to group payments? Or just direct transfer?
      // Using "destination" charge is better for Platform fees, but here we are paying OUT of our own funds effectively (or splitting).
      // Since we already collected payment, we use separate transfer.
      try {
        const transfer = await stripe.transfers.create({
          amount: commissionAmount,
          currency: "usd",
          destination: ambassador.stripe_account_id,
          description: `Commission for ${type === 'trial_bonus' ? 'Trial' : 'Pro'} Signup`,
          metadata: {
            referral_id: referral.id,
            event_id: eventId
          }
        });

        // 6. Log Commission
        await supabaseAdmin.from("commissions").insert({
          ambassador_id: referral.ambassador_id,
          referral_id: referral.id,
          amount: commissionAmount,
          type: type,
          stripe_transfer_id: transfer.id,
          status: "paid"
        });

        // 7. Trigger Ambassador Webhook
        try {
          // We need ambassador email and referred user email
          const { data: ambssUser } = await supabaseAdmin.from("profiles").select("email").eq("user_id", ambassador.user_id).single();
          const { data: refUser } = await supabaseAdmin.from("profiles").select("email, full_name, username").eq("user_id", profile.user_id).single();

          if (ambssUser?.email && refUser?.email) {
            // Need to import dynamically or at top of file
            const { sendAmbassadorWebhook } = await import("@/lib/ghl");
            await sendAmbassadorWebhook({
              ambassador_id: referral.ambassador_id,
              ambassador_email: ambssUser.email,
              referred_user_email: refUser.email,
              referred_user_name: refUser.full_name || refUser.username || "Referred User",
              type: "referral_success"
            });
          }
        } catch (webhookErr) {
          console.error("Failed to trigger ambassador GHL webhook:", webhookErr);
        }
      } catch (err: any) {
        console.error("Commission Transfer Failed:", err);
        await supabaseAdmin.from("commissions").insert({
          ambassador_id: referral.ambassador_id,
          referral_id: referral.id,
          amount: commissionAmount,
          type: type,
          status: "failed", // Needs manual retry
          metadata: { error: err.message }
        });
      }
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        // Handle ONE-TIME credit pack purchases
        if (session.mode === "payment") {
          const creditsAmount = session.metadata?.credits_amount;
          if (creditsAmount) {
            const credits = parseInt(creditsAmount, 10);
            if (!isNaN(credits) && credits > 0) {
              // Increment credits (not replace)
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("credits")
                .eq("stripe_customer_id", customerId)
                .single();

              const currentCredits = profile?.credits ?? 0;

              await supabaseAdmin
                .from("profiles")
                .update({
                  credits: currentCredits + credits,
                  updated_at: new Date().toISOString(),
                })
                .eq("stripe_customer_id", customerId);

              console.log(`💰 Credit top-up: Added ${credits} credits to customer ${customerId}`);
            }
          }
          break;
        }

        // Handle SUBSCRIPTION checkouts (existing logic)
        if (session.mode !== "subscription") break;

        const subscriptionId = session.subscription as string;

        // Check for Ambassador Metadata from Checkout
        // If we missed attribution during signup, we can catch it here via metadata if set (but we prefer DB source of truth)
        // Actually, we use the DB mainly.

        // Retrieve Subscription
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });

        const priceId =
          ((sub.items?.data?.[0]?.price as Stripe.Price | undefined)?.id as string | undefined) ??
          null;

        await updateProfile(session, {
          plan: "premium",
          stripe_subscription_id: subscriptionId,
          subscription_status: sub.status,
          current_period_end: getCurrentPeriodEndISO(sub),
          price_id: priceId,
          updated_at: new Date().toISOString(),
          credits: 200, // Pro: $10.00 worth (200 credits)
        });

        // COMMISSION LOGIC:
        // Identify if this is a "Trial" start ($1) or direct Pro.
        // The price checks can tell us.
        // Trial = $1.00 (100 cents)
        const amountTotal = session.amount_total || 0;

        if (amountTotal === 100) {
          // It's the $1 Trial
          await processCommission(customerId, amountTotal, 'trial_bonus', event.id);
        } else if (amountTotal >= 2900) {
          // Direct to Pro (if applicable) or subsequent payment caught here?
          // Usually subsequent payments are invoice.payment_succeeded.
          // But if initial checkout was full price, we assume commission.
          await processCommission(customerId, amountTotal, 'monthly_recurring', event.id);
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items?.data?.[0]?.price?.id ?? null;

        const isActive = sub.status === "active" || sub.status === "trialing";

        // Determine credits based on new plan status
        // If becoming active premium OR trialing -> 200
        // If not active (free) -> 40
        const credits = isActive ? 200 : 40;

        console.log(`Webhook: Subscription ${sub.id} is ${sub.status}. Granting ${credits} credits. isActive=${isActive}`);

        await updateProfile(sub, {
          plan: isActive ? "premium" : "free",
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          current_period_end: getCurrentPeriodEndISO(sub),
          price_id: priceId,
          updated_at: new Date().toISOString(),
          credits: credits,
        });

        // Force log for debugging
        if (sub.status === 'trialing') {
          console.log(`Webhook: Trial started for customer ${customerId}. Upgraded to Premium + 200 credits.`);
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Refill credits on successful payment (monthly renewal)
        if ((invoice as any).subscription) {
          // Manually handle invoice updates (no metadata usually on invoice object directly, but maybe on subscription)
          // For simplicity, we just use customerId here or try to fetch sub
          const subId = (invoice as any).subscription as string;
          // We can't use updateProfile easily here without fetching sub, so let's just use the fallback logic inline or simpler
          // Actually, let's just use customerId for invoices as they are subsequent events
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              credits: 200,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);

          if (error) console.error("Failed to update credits on invoice", error);

          // RECURRING COMMISSION
          // If amount_paid > 100 (more than $1), assume it's the monthly fee ($29+)
          if (invoice.amount_paid > 500) {
            await processCommission(customerId, invoice.amount_paid, 'monthly_recurring', event.id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await updateProfile(sub, {
          plan: "free",
          subscription_status: sub.status,
          current_period_end: null,
          updated_at: new Date().toISOString(),
          credits: 40, // Reset to Free default
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // "if payment fales after 2 attempts they go back down to free account"
        if (invoice.attempt_count >= 2) {
          console.log(`Payment failed 2+ times for ${customerId}. Downgrading to Free.`);
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              plan: "free",
              updated_at: new Date().toISOString(),
              credits: 40,
            })
            .eq("stripe_customer_id", customerId);
          if (error) console.error("Failed to downgrade on invoice fail", error);
        }

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
