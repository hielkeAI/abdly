import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await getActor();
  if (actor?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { name?: unknown; description?: unknown; questions?: unknown } | null;
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.length > 100) return NextResponse.json({ error: "A position name of 1–100 characters is required." }, { status: 400 });
  let rawQuestions: unknown;
  try {
    rawQuestions = typeof body.questions === "string" ? JSON.parse(body.questions) as unknown : body.questions;
  } catch {
    return NextResponse.json({ error: "Questions must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(rawQuestions) || rawQuestions.length > 20 || rawQuestions.some((question) => !question || typeof question !== "object" || typeof question.id !== "string" || typeof question.label !== "string")) {
    return NextResponse.json({ error: "Provide a valid list of up to 20 application questions." }, { status: 400 });
  }
  const questions = rawQuestions.map((question, index) => {
    const item = question as { id: string; label: string; required?: boolean };
    return { id: item.id.trim() || `question_${index + 1}`, label: item.label.trim().slice(0, 200), required: item.required !== false };
  });
  if (questions.some((question) => !question.label) || new Set(questions.map((question) => question.id)).size !== questions.length) {
    return NextResponse.json({ error: "Application questions need a label and unique IDs." }, { status: 400 });
  }
  const { data, error } = await createAdminClient().from("application_positions").insert({
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description.slice(0, 500) : "",
    questions,
    active: true,
  }).select("id").single();
  if (error) return errorResponse(new Error(error.message), 400);
  try {
    await audit("application_position.created", actor.user.id, null, { position_id: data.id, name: body.name });
    return NextResponse.json({ message: "Application position created." }, { status: 201 });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}

export async function PATCH(request: Request) {
  const actor = await getActor();
  if (actor?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { positionId?: unknown; active?: unknown } | null;
  const active = body?.active === "true" ? true : body?.active === "false" ? false : body?.active;
  if (typeof body?.positionId !== "string" || typeof active !== "boolean") return NextResponse.json({ error: "Position ID and active state are required." }, { status: 400 });
  const { error } = await createAdminClient().from("application_positions").update({ active }).eq("id", body.positionId).select("id").single();
  if (error) return errorResponse(new Error(error.message), 400);
  try {
    await audit(active ? "application_position.activated" : "application_position.deactivated", actor.user.id, null, { position_id: body.positionId });
    return NextResponse.json({ message: "Application position updated." });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}
