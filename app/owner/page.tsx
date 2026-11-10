import { ActionForm } from "@/components/action-form";
import { CustomerLookup } from "@/components/customer-lookup";
import { DashboardNav } from "@/components/dashboard-nav";
import { ModerationForm } from "@/components/moderation-form";
import { SignOutButton } from "@/components/sign-out-button";
import { requireActor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

function relationName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name ?? "Membership" : value?.name ?? "Membership";
}

export default async function OwnerDashboard() {
  const actor = await requireActor(["owner"]);
  const admin = createAdminClient();
  const [
    { data: analytics, error: analyticsError },
    { data: recentPurchases },
    { data: subscriptions },
    { data: supervisors },
    { data: plans },
    { data: roles },
    { data: positions },
    { data: applications },
    { data: reviews },
    { data: logs },
  ] = await Promise.all([
    admin.rpc("owner_payment_analytics"),
    admin.from("payments").select("id,user_id,amount_cents,currency,status,created_at,plan:plans(name)").order("created_at", { ascending: false }).limit(8),
    admin.from("subscriptions").select("id,user_id,status,current_period_end,cancel_at_period_end,stripe_subscription_id,plan:plans(name)").order("created_at", { ascending: false }).limit(100),
    admin.from("profiles").select("id,email,created_at").eq("role", "supervisor").order("created_at", { ascending: false }),
    admin.from("plans").select("id,name,description,billing_interval,amount_cents,currency,stripe_price_id,discord_role_id,active").order("created_at", { ascending: false }),
    admin.from("discord_roles").select("role_id,name,active").order("name"),
    admin.from("application_positions").select("id,name,description,questions,active").order("name"),
    admin.from("applications").select("id,user_id,position,status,answers,reviewer_note,created_at").order("created_at", { ascending: false }).limit(30),
    admin.from("reviews").select("id,user_id,rating,body,visible,created_at").order("created_at", { ascending: false }).limit(30),
    admin.from("activity_logs").select("id,actor_id,target_user_id,action,details,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (analyticsError || !analytics) throw new Error(`Unable to load owner analytics from the database: ${analyticsError?.message ?? "No analytics returned."}`);
  const metrics = analytics as {
    customers: number;
    active_subscriptions: number;
    totals: { currency: string; amount_cents: number; payment_count: number }[];
    monthly: { month: string; currency: string; amount_cents: number }[];
  };
  const chartCurrency = metrics.totals.find((item) => item.currency === "usd")?.currency ?? metrics.totals[0]?.currency ?? "usd";
  const monthlyRevenue = new Map<string, number>();
  const monthLabels: string[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthLabels.push(key);
    monthlyRevenue.set(key, 0);
  }
  for (const payment of metrics.monthly) {
    if (payment.currency === chartCurrency && monthlyRevenue.has(payment.month)) {
      monthlyRevenue.set(payment.month, payment.amount_cents);
    }
  }
  const maxMonthRevenue = Math.max(...monthlyRevenue.values(), 1);
  const userIds = [...new Set([
    ...(applications ?? []).map((item) => item.user_id),
    ...(reviews ?? []).map((item) => item.user_id),
    ...(recentPurchases ?? []).map((item) => item.user_id),
    ...(subscriptions ?? []).map((item) => item.user_id),
    ...(logs ?? []).flatMap((item) => [item.actor_id, item.target_user_id].filter((value): value is string => Boolean(value))),
  ])];
  const { data: memberProfiles } = userIds.length ? await admin.from("profiles").select("id,email,discord_username").in("id", userIds) : { data: [] };
  const profileMap = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile]));
  const managedRoles = roles ?? [];

  return <section className="dashboard-shell"><div className="dashboard-top"><div><p className="eyebrow">Platform controls</p><h1>Owner console</h1><p>Real-time overview and management for AbdlyAI.</p></div><SignOutButton /></div>
    <div className="dashboard-layout"><DashboardNav role="owner" /><div className="dashboard-main">
      <div className="metrics-grid"><article className="metric-card"><span>Total customers</span><strong>{metrics.customers}</strong><small>Registered customer accounts</small></article><article className="metric-card"><span>Verified revenue</span><strong style={{ fontSize: "clamp(16px,2vw,26px)" }}>{metrics.totals.length ? metrics.totals.map((item) => formatMoney(item.amount_cents, item.currency)).join(" · ") : "—"}</strong><small>Across {metrics.totals.reduce((total, item) => total + item.payment_count, 0)} verified payments</small></article><article className="metric-card"><span>Active subscriptions</span><strong>{metrics.active_subscriptions}</strong><small>Active or trialing Stripe subscriptions</small></article><article className="metric-card"><span>Pending applications</span><strong>{(applications ?? []).filter((item) => item.status === "pending").length}</strong><small>Awaiting staff review</small></article></div>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Revenue analytics</p><h2>Verified payment volume</h2></div><span className="muted">Last 6 months · {chartCurrency.toUpperCase()}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, alignItems: "end", minHeight: 150 }}>{monthLabels.map((month) => { const amount = monthlyRevenue.get(month) ?? 0; return <div key={month} style={{ textAlign: "center" }}><div title={formatMoney(amount, chartCurrency)} style={{ height: `${Math.max(4, amount / maxMonthRevenue * 110)}px`, marginBottom: 8, borderRadius: "7px 7px 2px 2px", background: "linear-gradient(180deg,#aa70ff,#448ff1)", opacity: amount ? 1 : .25 }} /><small className="muted">{new Date(`${month}-01`).toLocaleDateString(undefined, { month: "short" })}</small></div>; })}</div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent purchases</h2></div></div>{(recentPurchases ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>{recentPurchases!.map((payment) => <tr key={payment.id}><td>{new Date(payment.created_at).toLocaleDateString()}</td><td>{relationName(payment.plan as { name: string } | { name: string }[] | null)}</td><td>{profileMap.get(payment.user_id)?.discord_username ?? payment.user_id.slice(0, 8)}</td><td>{formatMoney(payment.amount_cents, payment.currency)}</td><td>{payment.status}</td></tr>)}</tbody></table></div> : <div className="empty-state">Verified Stripe purchases will appear here.</div>}</section>
      <CustomerLookup staffRole="owner" />
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Stripe subscriptions</p><h2>Manage subscriptions</h2></div></div>{(subscriptions ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Renewal</th><th>Action</th></tr></thead><tbody>{subscriptions!.map((subscription) => <tr key={subscription.id}><td>{profileMap.get(subscription.user_id)?.email ?? subscription.user_id.slice(0, 8)}</td><td>{relationName(subscription.plan as { name: string } | { name: string }[] | null)}</td><td>{subscription.status}{subscription.cancel_at_period_end ? " · canceling" : ""}</td><td>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "Lifetime"}</td><td>{subscription.stripe_subscription_id && ["active", "trialing", "past_due"].includes(subscription.status) && !subscription.cancel_at_period_end ? <ActionForm endpoint="/api/owner/subscriptions" submitLabel="Cancel at period end"><input type="hidden" name="subscriptionId" value={subscription.id} /></ActionForm> : "—"}</td></tr>)}</tbody></table></div> : <div className="empty-state">No subscription records are available.</div>}</section>
      <section className="panel" id="plans"><div className="panel-heading"><div><p className="eyebrow">Stripe-backed products</p><h2>Manage pricing</h2></div></div><ActionForm endpoint="/api/owner/plans" submitLabel="Add verified Stripe plan"><div className="form-grid"><label className="field-label">Plan name<input name="name" required maxLength={100} /></label><label className="field-label">Billing interval<select name="billingInterval" required><option value="month">Monthly</option><option value="lifetime">Lifetime, one-time</option></select></label><label className="field-label">Stripe Price ID<input name="stripePriceId" required placeholder="price_…" /></label><label className="field-label">Discord role<select name="discordRoleId" defaultValue=""><option value="">No role</option>{managedRoles.filter((role) => role.active).map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></label><label className="field-label full">Description<textarea name="description" maxLength={500} /></label></div></ActionForm>
        {(plans ?? []).length ? <div className="table-wrap" style={{ marginTop: 22 }}><table><thead><tr><th>Plan</th><th>Stripe Price</th><th>Price</th><th>Status</th><th>Availability</th></tr></thead><tbody>{plans!.map((plan) => <tr key={plan.id}><td>{plan.name} · {plan.billing_interval}</td><td>{plan.stripe_price_id}</td><td>{new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency.toUpperCase() }).format(plan.amount_cents / 100)}</td><td>{plan.active ? "Active" : "Hidden"}</td><td><ActionForm endpoint="/api/owner/plans" method="PATCH" submitLabel={plan.active ? "Deactivate" : "Activate"}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="active" value={String(!plan.active)} /></ActionForm></td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ marginTop: 15 }}>No plans are configured. Add a real Stripe Price ID to publish pricing.</div>}
      </section>
      <section className="panel" id="roles"><div className="panel-heading"><div><p className="eyebrow">Bot-managed roles</p><h2>Discord role catalog</h2></div></div><ActionForm endpoint="/api/owner/roles" submitLabel="Add Discord role"><label className="field-label">Discord role ID<input name="roleId" required inputMode="numeric" pattern="[0-9]{17,20}" placeholder="Copy from Discord developer mode" /></label></ActionForm>{managedRoles.length > 0 && <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>Role</th><th>Role ID</th><th>Status</th><th>Action</th></tr></thead><tbody>{managedRoles.map((role) => <tr key={role.role_id}><td>{role.name}</td><td>{role.role_id}</td><td>{role.active ? "Active" : "Removed"}</td><td><ActionForm endpoint="/api/owner/roles" method="DELETE" submitLabel="Remove from staff tools"><input type="hidden" name="roleId" value={role.role_id} /></ActionForm></td></tr>)}</tbody></table></div>}</section>
      <section className="panel" id="supervisors"><div className="panel-heading"><div><p className="eyebrow">Staff access</p><h2>Manage supervisors</h2></div></div><ActionForm endpoint="/api/owner/supervisors" submitLabel="Invite / grant supervisor access"><label className="field-label">Supervisor email<input name="email" type="email" required placeholder="supervisor@example.com" /></label></ActionForm>{(supervisors ?? []).length ? <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>Email</th><th>Added</th><th>Access</th></tr></thead><tbody>{supervisors!.map((supervisor) => <tr key={supervisor.id}><td>{supervisor.email}</td><td>{new Date(supervisor.created_at).toLocaleDateString()}</td><td><ActionForm endpoint="/api/owner/supervisors" method="DELETE" submitLabel="Remove access"><input type="hidden" name="userId" value={supervisor.id} /></ActionForm></td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ marginTop: 15 }}>No supervisors have been added.</div>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Team opportunities</p><h2>Application positions</h2></div></div><ActionForm endpoint="/api/owner/positions" submitLabel="Create position"><div className="form-grid"><label className="field-label">Position name<input name="name" required placeholder="e.g. Community Lead" /></label><label className="field-label">Description<input name="description" placeholder="Briefly describe this position" /></label><label className="field-label full">Questions (JSON array)<textarea name="questions" defaultValue={'[{"id":"experience","label":"Tell us about your relevant experience","required":true}]'} /></label></div></ActionForm>{(positions ?? []).length > 0 && <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>Position</th><th>Questions</th><th>Status</th><th>Action</th></tr></thead><tbody>{positions!.map((position) => <tr key={position.id}><td>{position.name}</td><td>{(position.questions as unknown[]).length}</td><td>{position.active ? "Open" : "Closed"}</td><td><ActionForm endpoint="/api/owner/positions" method="PATCH" submitLabel={position.active ? "Close" : "Open"}><input type="hidden" name="positionId" value={position.id} /><input type="hidden" name="active" value={String(!position.active)} /></ActionForm></td></tr>)}</tbody></table></div>}</section>
      <section className="panel" id="applications"><div className="panel-heading"><div><p className="eyebrow">Review queue</p><h2>Applications</h2></div></div>{(applications ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Applicant</th><th>Position</th><th>Submitted</th><th>Answers</th><th>Status</th><th>Decision</th></tr></thead><tbody>{applications!.map((application) => <tr key={application.id}><td>{profileMap.get(application.user_id)?.email ?? application.user_id.slice(0, 8)}</td><td>{application.position}</td><td>{new Date(application.created_at).toLocaleDateString()}</td><td><details><summary>View answers</summary><pre style={{ whiteSpace: "pre-wrap", minWidth: 180 }}>{JSON.stringify(application.answers, null, 2)}</pre></details></td><td><span className={`status-pill ${application.status}`}>{application.status}</span></td><td>{application.status === "pending" ? <ActionForm endpoint="/api/applications" method="PATCH" submitLabel="Decide"><input type="hidden" name="applicationId" value={application.id} /><select name="status"><option value="approved">Approve</option><option value="rejected">Reject</option></select><input name="note" placeholder="Optional reviewer note" /></ActionForm> : application.reviewer_note ?? "Reviewed"}</td></tr>)}</tbody></table></div> : <div className="empty-state">No applications have been submitted.</div>}</section>
      <section className="panel" id="reviews"><div className="panel-heading"><div><p className="eyebrow">Community moderation</p><h2>Customer reviews</h2></div></div>{(reviews ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rating</th><th>Review</th><th>Status</th><th>Moderation</th></tr></thead><tbody>{reviews!.map((review) => <tr key={review.id}><td>{profileMap.get(review.user_id)?.discord_username ?? profileMap.get(review.user_id)?.email ?? review.user_id.slice(0, 8)}</td><td>{review.rating}/5</td><td>{review.body}</td><td>{review.visible ? "Visible" : "Hidden"}</td><td><ModerationForm endpoint="/api/reviews" payload={{ reviewId: review.id, visible: !review.visible }} label={review.visible ? "Hide" : "Approve"} quiet /></td></tr>)}</tbody></table></div> : <div className="empty-state">No reviews have been submitted.</div>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Accountability</p><h2>Recent staff and system actions</h2></div></div>{(logs ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Actor</th><th>Details</th></tr></thead><tbody>{logs!.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td>{log.action}</td><td>{log.actor_id ? profileMap.get(log.actor_id)?.email ?? log.actor_id.slice(0, 8) : "System"}</td><td>{JSON.stringify(log.details)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Audited actions will appear here.</div>}</section>
      <p className="muted">Signed in as {actor.email}. Owner access is granted only to addresses in the server-side OWNER_EMAILS setting.</p>
    </div></div>
  </section>;
}
