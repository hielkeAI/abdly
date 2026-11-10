import Stripe from "stripe";
import { NextResponse } from "next/server";
import { requiredEnv } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignDiscordRole, revokeDiscordRole } from "@/lib/discord";
import { audit } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function setRole(userId: string, discordUserId: string | null, roleId: string | null, assign: boolean, source: string) {
  if (!roleId || !discordUserId) return;
  if (assign) await assignDiscordRole(discordUserId, roleId);
  else await revokeDiscordRole(discordUserId, roleId);
  await audit(assign ? "discord.role.assigned.automatic" : "discord.role.revoked.automatic", null, userId, { role_id: roleId, discord_user_id: discordUserId, source });
}

async function upsertSubscription(subscription: Stripe.Subscription, checkoutSessionId?: string) {
  const admin = createAdminClient();
  const userId = subscription.metadata.user_id;
  const planId = subscription.metadata.plan_id;
  if (!userId || !planId) throw new Error(`Stripe subscription ${subscription.id} is missing user or plan metadata.`);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const record: Record<string, unknown> = {
    user_id: userId,
    plan_id: planId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
  if (checkoutSessionId) record.stripe_checkout_session_id = checkoutSessionId;
  const { error } = await admin.from("subscriptions").upsert(record, { onConflict: "stripe_subscription_id" });
  if (error) throw new Error(`Unable to record subscription ${subscription.id}: ${error.message}`);
}

async function recordPayment(eventId: string, session: Stripe.Checkout.Session) {
  if (!session.metadata?.user_id || !session.metadata.plan_id || session.payment_status !== "paid") return;
  const admin = createAdminClient();
  const { error } = await admin.from("payments").upsert({
    user_id: session.metadata.user_id,
    plan_id: session.metadata.plan_id,
    stripe_event_id: eventId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status: "succeeded",
  }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  if (error) throw new Error(`Unable to record verified Stripe payment: ${error.message}`);
}

async function recordLifetimeMembership(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!userId || !planId || !customerId || session.payment_status !== "paid") return;
  const { error } = await createAdminClient().from("subscriptions").upsert({
    user_id: userId,
    plan_id: planId,
    stripe_customer_id: customerId,
    stripe_checkout_session_id: session.id,
    status: "active",
    current_period_end: null,
    cancel_at_period_end: false,
  }, { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true });
  if (error) throw new Error(`Unable to record lifetime membership: ${error.message}`);
}

async function revokeRoleIfUnused(userId: string, discordUserId: string | null, roleId: string | null, subscriptionId: string, source: string) {
  if (!roleId || !discordUserId) return;
  const admin = createAdminClient();
  const { data: activeMemberships, error: membershipsError } = await admin.from("subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);
  if (membershipsError) throw new Error(`Unable to check remaining memberships: ${membershipsError.message}`);
  const planIds = [...new Set((activeMemberships ?? []).map((membership) => membership.plan_id).filter((id): id is string => Boolean(id)))];
  if (planIds.length) {
    const { data: plans, error: plansError } = await admin.from("plans").select("discord_role_id").in("id", planIds);
    if (plansError) throw new Error(`Unable to check remaining membership roles: ${plansError.message}`);
    if ((plans ?? []).some((plan) => plan.discord_role_id === roleId)) {
      await audit("discord.role.retained.membership_active", null, userId, { role_id: roleId, subscription_id: subscriptionId, source });
      return;
    }
  }
  await setRole(userId, discordUserId, roleId, false, source);
}

async function revokeExpiredSubscriptionRole(subscription: Stripe.Subscription, source: string) {
  const userId = subscription.metadata.user_id;
  const planId = subscription.metadata.plan_id;
  if (!userId || !planId) return;
  const admin = createAdminClient();
  const [{ data: plan, error: planError }, { data: profile, error: profileError }] = await Promise.all([
    admin.from("plans").select("discord_role_id").eq("id", planId).single(),
    admin.from("profiles").select("discord_user_id").eq("id", userId).single(),
  ]);
  if (planError || profileError) throw new Error("Unable to load the expired subscription plan or customer profile.");
  await revokeRoleIfUnused(
    userId,
    profile?.discord_user_id ?? subscription.metadata.discord_user_id ?? null,
    plan?.discord_role_id ?? null,
    subscription.id,
    source,
  );
}

async function processEvent(event: Stripe.Event) {
  const admin = createAdminClient();
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment") {
        await recordPayment(event.id, session);
        if (session.payment_status === "paid" && session.metadata?.user_id && session.metadata.plan_id) {
          await recordLifetimeMembership(session);
          const [{ data: plan, error: planError }, { data: profile, error: profileError }] = await Promise.all([
            admin.from("plans").select("discord_role_id").eq("id", session.metadata.plan_id).single(),
            admin.from("profiles").select("discord_user_id").eq("id", session.metadata.user_id).single(),
          ]);
          if (planError || profileError) throw new Error("Unable to load the purchased plan or customer profile.");
          await setRole(session.metadata.user_id, profile?.discord_user_id ?? session.metadata.discord_user_id ?? null, plan?.discord_role_id ?? null, true, event.id);
        }
      } else if (session.mode === "subscription" && session.subscription) {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await upsertSubscription(subscription, session.id);
        if (session.payment_status === "paid" && ["active", "trialing"].includes(subscription.status)) {
          const [{ data: plan }, { data: profile }] = await Promise.all([
            admin.from("plans").select("discord_role_id").eq("id", subscription.metadata.plan_id).single(),
            admin.from("profiles").select("discord_user_id").eq("id", subscription.metadata.user_id).single(),
          ]);
          await setRole(subscription.metadata.user_id, profile?.discord_user_id ?? subscription.metadata.discord_user_id ?? null, plan?.discord_role_id ?? null, true, event.id);
        }
      }
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) return;
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await upsertSubscription(subscription);
      const userId = subscription.metadata.user_id;
      const planId = subscription.metadata.plan_id;
      if (!userId || !planId) throw new Error(`Stripe subscription ${subscription.id} is missing payment metadata.`);
      const { error } = await admin.from("payments").upsert({
        user_id: userId,
        plan_id: planId,
        stripe_event_id: event.id,
        stripe_payment_intent_id: typeof invoice.payment_intent === "string" ? invoice.payment_intent : null,
        amount_cents: invoice.amount_paid,
        currency: invoice.currency,
        status: "succeeded",
      }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
      if (error) throw new Error(`Unable to record verified invoice: ${error.message}`);
      const [{ data: plan, error: planError }, { data: profile, error: profileError }] = await Promise.all([
        admin.from("plans").select("discord_role_id").eq("id", planId).single(),
        admin.from("profiles").select("discord_user_id").eq("id", userId).single(),
      ]);
      if (planError || profileError) throw new Error("Unable to load the paid subscription plan or customer profile.");
      if (["active", "trialing"].includes(subscription.status)) {
        await setRole(userId, profile?.discord_user_id ?? subscription.metadata.discord_user_id ?? null, plan?.discord_role_id ?? null, true, event.id);
      }
      return;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscription(subscription);
      if (["canceled", "incomplete_expired", "unpaid"].includes(subscription.status)) await revokeExpiredSubscriptionRole(subscription, event.id);
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscription(subscription);
      await revokeExpiredSubscriptionRole(subscription, event.id);
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature verification failed.";
    return NextResponse.json({ error: `Invalid Stripe webhook: ${message}` }, { status: 400 });
  }
  try {
    await processEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    console.error(`Stripe webhook ${event.id} failed: ${message}`);
    return NextResponse.json({ error: "Webhook processing failed; Stripe may retry this event." }, { status: 500 });
  }
}
