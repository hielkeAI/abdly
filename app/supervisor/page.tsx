import { ActionForm } from "@/components/action-form";
import { CustomerLookup } from "@/components/customer-lookup";
import { DashboardNav } from "@/components/dashboard-nav";
import { ModerationForm } from "@/components/moderation-form";
import { SignOutButton } from "@/components/sign-out-button";
import { requireActor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SupervisorDashboard() {
  const actor = await requireActor(["supervisor"]);
  const admin = createAdminClient();
  const [{ data: applications }, { data: reviews }, { data: logs }] = await Promise.all([
    admin.from("applications").select("id,user_id,reviewer_id,position,status,answers,reviewer_note,created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("reviews").select("id,user_id,rating,body,visible,created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("activity_logs").select("id,action,target_user_id,details,created_at").eq("actor_id", actor.user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const pending = (applications ?? []).filter((application) => application.status === "pending").length;
  const profileIds = [...new Set([...(applications ?? []).map((item) => item.user_id), ...(reviews ?? []).map((item) => item.user_id)])];
  const { data: profiles } = profileIds.length ? await admin.from("profiles").select("id,email,discord_username").in("id", profileIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return <section className="dashboard-shell"><div className="dashboard-top"><div><p className="eyebrow">Community operations</p><h1>Supervisor console</h1><p>Customer support, application review, and community moderation.</p></div><SignOutButton /></div>
    <div className="dashboard-layout"><DashboardNav role="supervisor" /><div className="dashboard-main">
      <div className="metrics-grid"><article className="metric-card"><span>Pending applications</span><strong>{pending}</strong><small>Awaiting a decision</small></article><article className="metric-card"><span>Applications reviewed</span><strong>{(applications ?? []).filter((item) => item.reviewer_id === actor.user.id).length}</strong><small>Recent submissions</small></article><article className="metric-card"><span>Visible reviews</span><strong>{(reviews ?? []).filter((item) => item.visible).length}</strong><small>Customer feedback</small></article><article className="metric-card"><span>Your actions</span><strong>{logs?.length ?? 0}</strong><small>Recent audited actions</small></article></div>
      <CustomerLookup staffRole="supervisor" />
      <section className="panel" id="applications"><div className="panel-heading"><div><p className="eyebrow">Review queue</p><h2>Applications</h2></div></div>{(applications ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Applicant</th><th>Position</th><th>Submitted</th><th>Answers</th><th>Status</th><th>Decision</th></tr></thead><tbody>{applications!.map((application) => <tr key={application.id}><td>{profileMap.get(application.user_id)?.email ?? application.user_id.slice(0, 8)}</td><td>{application.position}</td><td>{new Date(application.created_at).toLocaleDateString()}</td><td><details><summary>View answers</summary><pre style={{ whiteSpace: "pre-wrap", minWidth: 180 }}>{JSON.stringify(application.answers, null, 2)}</pre></details></td><td><span className={`status-pill ${application.status}`}>{application.status}</span></td><td>{application.status === "pending" ? <ActionForm endpoint="/api/applications" method="PATCH" submitLabel="Decide"><input type="hidden" name="applicationId" value={application.id} /><select name="status"><option value="approved">Approve</option><option value="rejected">Reject</option></select><input name="note" placeholder="Optional reviewer note" /></ActionForm> : application.reviewer_note ?? "Reviewed"}</td></tr>)}</tbody></table></div> : <div className="empty-state">No applications have been submitted.</div>}</section>
      <section className="panel" id="reviews"><div className="panel-heading"><div><p className="eyebrow">Customer feedback</p><h2>Review moderation</h2></div></div>{(reviews ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rating</th><th>Review</th><th>Status</th><th>Moderation</th></tr></thead><tbody>{reviews!.map((review) => <tr key={review.id}><td>{profileMap.get(review.user_id)?.discord_username ?? profileMap.get(review.user_id)?.email ?? review.user_id.slice(0, 8)}</td><td>{review.rating}/5</td><td>{review.body}</td><td>{review.visible ? "Visible" : "Hidden"}</td><td><ModerationForm endpoint="/api/reviews" payload={{ reviewId: review.id, visible: !review.visible }} label={review.visible ? "Hide" : "Approve"} quiet /></td></tr>)}</tbody></table></div> : <div className="empty-state">No reviews have been submitted.</div>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Staff audit trail</p><h2>Your recent actions</h2></div></div>{(logs ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{logs!.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td>{log.action}</td><td>{log.target_user_id ? profileMap.get(log.target_user_id)?.discord_username ?? log.target_user_id.slice(0, 8) : "—"}</td><td>{JSON.stringify(log.details)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Actions you take will be recorded here.</div>}</section>
      <p className="muted">Staff actions are audited. Owner settings, pricing, supervisor access, and Stripe configuration are not available in this console.</p>
    </div></div>
  </section>;
}
