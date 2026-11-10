import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

async function owner() {
  const actor = await getActor();
  return actor?.role === "owner" ? actor : null;
}

export async function POST(request: Request) {
  const actor = await owner();
  if (!actor) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  if (typeof body?.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return NextResponse.json({ error: "Enter a valid supervisor email address." }, { status: 400 });
  const email = body.email.trim().toLowerCase();
  const ownerEmails = (process.env.OWNER_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase());
  if (ownerEmails.includes(email)) return NextResponse.json({ error: "An owner account cannot be downgraded to supervisor." }, { status: 400 });
  const admin = createAdminClient();
  const { data: user, error: userError } = await admin.from("profiles").select("id,role").eq("email", email).maybeSingle();
  if (userError) return errorResponse(new Error(userError.message), 500);
  if (user?.role === "owner") return NextResponse.json({ error: "An owner account cannot be downgraded to supervisor." }, { status: 400 });
  let userId = user?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) return errorResponse(new Error(error?.message ?? "Unable to invite supervisor."), 400);
    userId = data.user.id;
  }
  const { error } = await admin.from("profiles").upsert({ id: userId, email, role: "supervisor" }, { onConflict: "id" });
  if (error) return errorResponse(new Error(error.message), 500);
  try {
    await audit("supervisor.added", actor.user.id, userId, { email });
    return NextResponse.json({ message: `Supervisor access granted to ${email}.` }, { status: 201 });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}

export async function DELETE(request: Request) {
  const actor = await owner();
  if (!actor) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown } | null;
  if (typeof body?.userId !== "string") return NextResponse.json({ error: "A user ID is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: target, error: fetchError } = await admin.from("profiles").select("id,email,role").eq("id", body.userId).single();
  if (fetchError || !target) return errorResponse(new Error(fetchError?.message ?? "Supervisor not found."), 404);
  if (target.role !== "supervisor") return NextResponse.json({ error: "That account is not a supervisor." }, { status: 400 });
  const { error } = await admin.from("profiles").update({ role: "customer" }).eq("id", body.userId);
  if (error) return errorResponse(new Error(error.message), 500);
  try {
    await audit("supervisor.removed", actor.user.id, body.userId, { email: target.email });
    return NextResponse.json({ message: "Supervisor access removed." });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}
