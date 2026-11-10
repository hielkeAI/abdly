import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { getActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const actor = await getActor();
  const admin = await createClient();
  const [{ data: reviews }, { data: mine }] = await Promise.all([
    admin.from("reviews").select("id,user_id,rating,body,created_at").eq("visible", true).order("created_at", { ascending: false }).limit(50),
    actor ? admin.from("reviews").select("id,rating,body,visible").eq("user_id", actor.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Member voices</p><h1>Built <span className="accent">together.</span></h1><p>What people in the AbdlyAI community are saying.</p></div>
    {actor ? <div className="panel" style={{ maxWidth: 700, margin: "0 auto 30px" }}><div className="panel-heading"><div><p className="eyebrow">Your review</p><h2>{mine ? "Update your review" : "Share your experience"}</h2></div></div><ActionForm endpoint="/api/reviews" submitLabel={mine ? "Update review" : "Submit review"}><label className="field-label">Rating<select name="rating" defaultValue={mine?.rating ?? 5}><option value="5">5 — Excellent</option><option value="4">4 — Great</option><option value="3">3 — Good</option><option value="2">2 — Needs work</option><option value="1">1 — Poor</option></select></label><label className="field-label">Your review<textarea name="body" minLength={5} maxLength={2000} required defaultValue={mine?.body ?? ""} placeholder="What has your experience been like?" /></label></ActionForm>{mine && !mine.visible && <p className="muted" style={{ marginTop: 12 }}>Your review is hidden while our moderators review it. Updating it will not make it public.</p>}</div> : <p className="center muted" style={{ marginBottom: 28 }}><Link href="/login">Sign in</Link> to share a review.</p>}
    {(reviews ?? []).length ? <div className="feature-grid">{reviews!.map((review) => <article className="feature-card" key={review.id}><p className="eyebrow">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p><p style={{ color: "#dedee8" }}>{review.body}</p><p className="muted">AbdlyAI member · {new Date(review.created_at).toLocaleDateString()}</p></article>)}</div> : <div className="empty-state">No public reviews yet.</div>}
  </section>;
}
