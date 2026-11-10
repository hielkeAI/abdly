import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { errorResponse } from "@/lib/http";

export async function POST() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  const { data: profile, error } = await createAdminClient().from("profiles").select("stripe_customer_id").eq("id", actor.user.id).single();
  if (error || !profile?.stripe_customer_id) return NextResponse.json({ error: "No Stripe billing account is associated with this profile." }, { status: 404 });
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl()}/dashboard`,
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
    });
    return NextResponse.json({ url: portal.url });
  } catch (cause) {
    return errorResponse(cause, 502);
  }
}
