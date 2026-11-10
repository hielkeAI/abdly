import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assignDiscordRole, revokeDiscordRole } from "@/lib/discord";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

async function change(request: Request, assign: boolean) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!["owner", "supervisor"].includes(actor.role)) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown; roleId?: unknown } | null;
  if (typeof body?.userId !== "string" || typeof body.roleId !== "string") return NextResponse.json({ error: "Customer and role are required." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: target, error: targetError }, { data: role, error: roleError }] = await Promise.all([
    admin.from("profiles").select("id,discord_user_id").eq("id", body.userId).single(),
    admin.from("discord_roles").select("role_id,name").eq("role_id", body.roleId).eq("active", true).single(),
  ]);
  if (targetError || !target) return NextResponse.json({ error: "Customer account not found." }, { status: 404 });
  if (roleError || !role) return NextResponse.json({ error: "That role is not configured for staff management." }, { status: 404 });
  if (!target.discord_user_id) return NextResponse.json({ error: "The customer has not linked a Discord account." }, { status: 400 });
  try {
    if (assign) await assignDiscordRole(target.discord_user_id, role.role_id);
    else await revokeDiscordRole(target.discord_user_id, role.role_id);
    await audit(assign ? "discord.role.assigned.manual" : "discord.role.revoked.manual", actor.user.id, target.id, { role_id: role.role_id, discord_user_id: target.discord_user_id });
    return NextResponse.json({ message: `${role.name} ${assign ? "assigned to" : "revoked from"} the customer.` });
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  return change(request, true);
}

export async function DELETE(request: Request) {
  return change(request, false);
}
