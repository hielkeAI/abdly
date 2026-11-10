import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in before starting checkout." }, { status: 401 });
  const body = await request.json().catch(() => null) as { planId?: unknown } | null;
  if (typeof body?.planId !== "string") return NextResponse.json({ error: "A valid plan is required." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: plan, error: planError }, { data: profile, error: profileError }] = await Promise.all([
    admin.from("plans").select("id,name,billing_interval,stripe_price_id,discord_role_id,active").eq("id", body.planId).eq("active", true).single(),
    admin.from("profiles").select("discord_user_id,stripe_customer_id").eq("id", actor.user.id).single(),
  ]);
  if (planError || !plan) return NextResponse.json({ error: "That plan is unavailable." }, { status: 404 });
  if (profileError || !profile) return NextResponse.json({ error: "Your account profile is not ready." }, { status: 500 });
  if (!profile.discord_user_id) return NextResponse.json({ error: "Link your Discord account in your dashboard before purchasing." }, { status: 400 });

  try {
    const stripe = getStripe();
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: actor.user.email,
        metadata: { user_id: actor.user.id },
      });
      customerId = customer.id;
      const { error: customerError } = await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", actor.user.id);
      if (customerError) throw new Error(`Unable to save Stripe customer: ${customerError.message}`);
    }

    const isSubscription = plan.billing_interval === "month";
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${appUrl()}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
      client_reference_id: actor.user.id,
      metadata: { user_id: actor.user.id, plan_id: plan.id, discord_user_id: profile.discord_user_id },
      ...(isSubscription ? { subscription_data: { metadata: { user_id: actor.user.id, plan_id: plan.id, discord_user_id: profile.discord_user_id } } } : {}),
    });
    if (!session.url) return NextResponse.json({ error: "Stripe did not provide a checkout URL." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
