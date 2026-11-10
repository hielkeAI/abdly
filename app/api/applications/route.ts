import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in before applying." }, { status: 401 });
  const body = await request.json().catch(() => null) as { positionId?: unknown; answers?: unknown } | null;
  if (typeof body?.positionId !== "string" || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Choose a position and provide your answers." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: position, error: positionError } = await admin.from("application_positions").select("name,questions,active").eq("id", body.positionId).single();
  if (positionError || !position || !position.active) return NextResponse.json({ error: "That position is no longer accepting applications." }, { status: 404 });
  const questions = position.questions as { id: string; label: string; required?: boolean }[];
  const answers = body.answers as Record<string, unknown>;
  const cleanAnswers: Record<string, string> = {};
  for (const question of questions) {
    const answer = answers[question.id];
    if (answer !== undefined && typeof answer !== "string") {
      return NextResponse.json({ error: `Answer for “${question.label}” must be text.` }, { status: 400 });
    }
    if (question.required !== false && (typeof answer !== "string" || !answer.trim())) {
      return NextResponse.json({ error: `Please answer: ${question.label}` }, { status: 400 });
    }
    if (typeof answer === "string" && answer.length > 4000) {
      return NextResponse.json({ error: "Application answers must be 4,000 characters or fewer." }, { status: 400 });
    }
    cleanAnswers[question.label] = typeof answer === "string" ? answer.trim() : "";
  }
  try {
    const { error } = await admin.from("applications").insert({
      user_id: actor.user.id,
      position: position.name,
      answers: cleanAnswers,
    });
    if (error) return errorResponse(new Error(error.message), 500);
    await audit("application.submitted", actor.user.id, actor.user.id, { position: position.name });
    return NextResponse.json({ message: "Your application has been submitted." }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function PATCH(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!["owner", "supervisor"].includes(actor.role)) return NextResponse.json({ error: "You cannot review applications." }, { status: 403 });
  const body = await request.json().catch(() => null) as { applicationId?: unknown; status?: unknown; note?: unknown } | null;
  if (typeof body?.applicationId !== "string" || !["approved", "rejected"].includes(String(body.status))) {
    return NextResponse.json({ error: "A valid application and decision are required." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;
  const admin = createAdminClient();
  const { data: application, error: updateError } = await admin.from("applications").update({
    status: body.status,
    reviewer_id: actor.user.id,
    reviewer_note: note,
  }).eq("id", body.applicationId).select("id,user_id,position,status").single();
  if (updateError || !application) return errorResponse(new Error(updateError?.message ?? "Application not found."), 404);
  try {
    await audit(`application.${body.status}`, actor.user.id, application.user_id, { application_id: application.id, position: application.position, note });
    return NextResponse.json({ message: `Application ${body.status}.` });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
