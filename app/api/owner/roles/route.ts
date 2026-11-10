import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getGuildRole } from "@/lib/discord";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const actor = await getActor();
  if (!actor || !["owner", "supervisor"].includes(actor.role)) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const { data, error } = await createAdminClient().from("discord_roles").select("role_id,name").eq("active", true).order("name");
  if (error) return errorResponse(new Error(error.message), 500);
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { roleId?: unknown } | null;
  if (typeof body?.roleId !== "string" || !/^\d{17,20}$/.test(body.roleId)) return NextResponse.json({ error: "Enter a valid Discord role ID." }, { status: 400 });
  try {
    const role = await getGuildRole(body.roleId);
    if (!role) return NextResponse.json({ error: "That role is not in the configured Discord server." }, { status: 404 });
    if (role.managed) return NextResponse.json({ error: "Discord-managed roles cannot be assigned by the bot." }, { status: 400 });
    const { error } = await createAdminClient().from("discord_roles").upsert({ role_id: role.id, name: role.name, active: true }, { onConflict: "role_id" });
    if (error) return errorResponse(new Error(error.message), 400);
    await audit("discord.role.configured", actor.user.id, null, { role_id: role.id, name: role.name });
    return NextResponse.json({ message: `Discord role “${role.name}” is available to staff.` }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function DELETE(request: Request) {
  const actor = await getActor();
  if (actor?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { roleId?: unknown } | null;
  if (typeof body?.roleId !== "string") return NextResponse.json({ error: "A role ID is required." }, { status: 400 });
  const { error } = await createAdminClient().from("discord_roles").update({ active: false }).eq("role_id", body.roleId).select("role_id").single();
  if (error) return errorResponse(new Error(error.message), 400);
  try {
    await audit("discord.role.unconfigured", actor.user.id, null, { role_id: body.roleId });
    return NextResponse.json({ message: "Role removed from AbdlyAI staff management." });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}
