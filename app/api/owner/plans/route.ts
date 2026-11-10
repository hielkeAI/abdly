import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

async function checkOwner() {
  const actor = await getActor();
  return actor?.role === "owner" ? actor : null;
}

async function validateStripePrice(priceId: string, interval: "month" | "lifetime") {
  const price = await getStripe().prices.retrieve(priceId);
  if (!price.active || price.type !== (interval === "month" ? "recurring" : "one_time")) throw new Error("The Stripe Price must be active and match the selected billing interval.");
  if (interval === "month" && price.recurring?.interval !== "month") throw new Error("Monthly AbdlyAI plans require a monthly Stripe Price.");
  if (price.unit_amount === null) throw new Error("Stripe Price must have a fixed unit amount.");
  return { amount_cents: price.unit_amount, currency: price.currency };
}

export async function POST(request: Request) {
  const actor = await checkOwner();
  if (!actor) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.name !== "string" || !body.name.trim() || !["month", "lifetime"].includes(String(body.billingInterval)) || typeof body.stripePriceId !== "string" || !body.stripePriceId.startsWith("price_")) {
    return NextResponse.json({ error: "Name, billing interval, and a valid Stripe Price ID are required." }, { status: 400 });
  }
  try {
    const interval = body.billingInterval as "month" | "lifetime";
    const stripePrice = await validateStripePrice(body.stripePriceId, interval);
    const { data: plan, error } = await createAdminClient().from("plans").insert({
      name: body.name.trim().slice(0, 100),
      description: typeof body.description === "string" ? body.description.slice(0, 500) : "",
      billing_interval: interval,
      amount_cents: stripePrice.amount_cents,
      currency: stripePrice.currency,
      stripe_price_id: body.stripePriceId,
      discord_role_id: typeof body.discordRoleId === "string" && body.discordRoleId ? body.discordRoleId : null,
      active: true,
    }).select("id").single();
    if (error) return errorResponse(new Error(error.message), 400);
    await audit("plan.created", actor.user.id, null, { plan_id: plan.id, stripe_price_id: body.stripePriceId });
    return NextResponse.json({ message: "Plan added using the verified Stripe Price." }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 400);
  }
}

export async function PATCH(request: Request) {
  const actor = await checkOwner();
  if (!actor) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { planId?: unknown; active?: unknown; name?: unknown; description?: unknown; discordRoleId?: unknown } | null;
  if (typeof body?.planId !== "string") return NextResponse.json({ error: "A valid plan is required." }, { status: 400 });
  const updates: Record<string, unknown> = {};
  const active = body.active === "true" ? true : body.active === "false" ? false : body.active;
  if (typeof active === "boolean") updates.active = active;
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Plan name cannot be empty." }, { status: 400 });
    updates.name = body.name.trim().slice(0, 100);
  }
  if (typeof body.description === "string") updates.description = body.description.slice(0, 500);
  if (body.discordRoleId === null) updates.discord_role_id = null;
  if (typeof body.discordRoleId === "string" && body.discordRoleId) {
    const { data: role, error: roleError } = await createAdminClient().from("discord_roles").select("role_id").eq("role_id", body.discordRoleId).eq("active", true).maybeSingle();
    if (roleError || !role) return NextResponse.json({ error: "Select an active, configured Discord role." }, { status: 400 });
    updates.discord_role_id = body.discordRoleId;
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: "No editable plan fields were supplied." }, { status: 400 });
  const { error } = await createAdminClient().from("plans").update(updates).eq("id", body.planId).select("id").single();
  if (error) return errorResponse(new Error(error.message), 400);
  try {
    await audit("plan.updated", actor.user.id, null, { plan_id: body.planId, fields: Object.keys(updates) });
    return NextResponse.json({ message: "Plan updated." });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}
