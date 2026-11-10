import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { getDiscordMember, getGuildRoles } from "@/lib/discord";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/http";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!["owner", "supervisor"].includes(actor.role)) return NextResponse.json({ error: "Customer lookup requires staff access." }, { status: 403 });
  const discordUserId = new URL(request.url).searchParams.get("discordUserId")?.trim();
  if (!discordUserId || !/^\d{17,20}$/.test(discordUserId)) return NextResponse.json({ error: "Enter a valid Discord user ID (17–20 digits)." }, { status: 400 });
  const admin = createAdminClient();
  const { data: customer, error } = await admin.from("profiles").select("id,email,discord_user_id,discord_username").eq("discord_user_id", discordUserId).maybeSingle();
  if (error) return errorResponse(new Error(error.message), 500);
  if (!customer) return NextResponse.json({ error: "No AbdlyAI account is linked to that Discord ID." }, { status: 404 });
  const [{ data: subscriptions, error: subscriptionsError }, { data: payments, error: paymentsError }] = await Promise.all([
    admin.from("subscriptions").select("id,status,current_period_end,cancel_at_period_end,plan:plans(name)").eq("user_id", customer.id).order("created_at", { ascending: false }),
    admin.from("payments").select("id,amount_cents,currency,status,created_at,plan:plans(name)").eq("user_id", customer.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (subscriptionsError || paymentsError) return errorResponse(new Error("Unable to load customer membership history."), 500);
  try {
    const member = await getDiscordMember(discordUserId);
    const guildRoles = member ? await getGuildRoles() : [];
    const roleNames = new Map(guildRoles.map((role) => [role.id, role.name]));
    return NextResponse.json({ customer, subscriptions, payments, discord: member ? { username: member.user.username, roles: member.roles.map((id) => ({ id, name: roleNames.get(id) ?? id })) } : null });
  } catch (cause) {
    return errorResponse(cause, 502);
  }
}
