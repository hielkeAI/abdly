import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in before leaving a review." }, { status: 401 });
  const body = await request.json().catch(() => null) as { rating?: unknown; body?: unknown } | null;
  const rating = typeof body?.rating === "string" ? Number(body.rating) : body?.rating;
  if (!Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5 || typeof body?.body !== "string" || body.body.trim().length < 5 || body.body.trim().length > 2000) {
    return NextResponse.json({ error: "Provide a rating from 1–5 and a review between 5 and 2,000 characters." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin.from("reviews").select("id,visible").eq("user_id", actor.user.id).maybeSingle();
  if (existingError) return errorResponse(new Error(existingError.message), 500);
  const query = existing
    ? admin.from("reviews").update({ rating, body: body.body.trim() }).eq("id", existing.id)
    : admin.from("reviews").insert({ user_id: actor.user.id, rating, body: body.body.trim(), visible: true });
  const { error } = await query;
  if (error) return errorResponse(new Error(error.message), 400);
  try {
    await audit(existing ? "review.updated" : "review.submitted", actor.user.id, actor.user.id, { rating, remains_hidden: existing ? !existing.visible : false });
    return NextResponse.json({ message: existing?.visible === false ? "Your review was updated and remains hidden pending moderation." : "Thank you. Your review has been submitted." }, { status: existing ? 200 : 201 });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function PATCH(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!["owner", "supervisor"].includes(actor.role)) return NextResponse.json({ error: "You cannot moderate reviews." }, { status: 403 });
  const body = await request.json().catch(() => null) as { reviewId?: unknown; visible?: unknown } | null;
  if (typeof body?.reviewId !== "string" || typeof body.visible !== "boolean") return NextResponse.json({ error: "A review and visibility value are required." }, { status: 400 });
  const { data: review, error } = await createAdminClient().from("reviews").update({ visible: body.visible, moderator_id: actor.user.id }).eq("id", body.reviewId).select("id,user_id,visible").single();
  if (error || !review) return errorResponse(new Error(error?.message ?? "Review not found."), 404);
  try {
    await audit(review.visible ? "review.approved" : "review.hidden", actor.user.id, review.user_id, { review_id: review.id });
    return NextResponse.json({ message: review.visible ? "Review is visible." : "Review has been hidden." });
  } catch (cause) {
    return errorResponse(cause, 500);
  }
}
