import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { subscriptionId?: unknown } | null;
  if (typeof body?.subscriptionId !== "string") return NextResponse.json({ error: "A subscription ID is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: record, error } = await admin.from("subscriptions").select("id,user_id,stripe_subscription_id,status").eq("id", body.subscriptionId).single();
  if (error || !record) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  if (!record.stripe_subscription_id || !["active", "trialing", "past_due"].includes(record.status)) return NextResponse.json({ error: "Only active Stripe subscriptions can be cancelled." }, { status: 400 });
  try {
    await getStripe().subscriptions.update(record.stripe_subscription_id, { cancel_at_period_end: true });
    await audit("subscription.cancel.requested", actor.user.id, record.user_id, { subscription_id: record.id });
    return NextResponse.json({ message: "Subscription cancellation scheduled. Discord access remains through the paid period and is removed when Stripe confirms expiration." });
  } catch (cause) {
    return errorResponse(cause, 502);
  }
}
