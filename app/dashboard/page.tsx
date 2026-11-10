import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountLinks } from "@/components/account-links";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { DashboardNav } from "@/components/dashboard-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { requireActor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CustomerDashboard({ searchParams }: { searchParams: Promise<{ linked?: string; error?: string }> }) {
  const { linked, error: linkError } = await searchParams;
  const actor = await requireActor();
  if (actor.role === "owner") redirect("/owner");
  if (actor.role === "supervisor") redirect("/supervisor");
  const admin = createAdminClient();
  const [{ data: profile }, { data: subscriptions }, { data: payments }, { data: apps }] = await Promise.all([
    admin.from("profiles").select("discord_user_id,discord_username,github_username,huggingface_username").eq("id", actor.user.id).single(),
    admin.from("subscriptions").select("id,status,current_period_end,cancel_at_period_end,plan:plans(name,billing_interval)").eq("user_id", actor.user.id).order("created_at", { ascending: false }),
    admin.from("payments").select("id,amount_cents,currency,status,created_at,plan:plans(name)").eq("user_id", actor.user.id).order("created_at", { ascending: false }).limit(5),
    admin.from("applications").select("id,position,status,created_at").eq("user_id", actor.user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  return <section className="dashboard-shell"><div className="dashboard-top"><div><p className="eyebrow">Member space</p><h1>Welcome back.</h1><p>Your AbdlyAI membership, all in one place.</p></div><SignOutButton /></div>
    <div className="dashboard-layout"><DashboardNav role="customer" /><div className="dashboard-main">
      <div className="metrics-grid"><article className="metric-card"><span>Account</span><strong>Active</strong><small>{actor.email}</small></article><article className="metric-card"><span>Subscriptions</span><strong>{(subscriptions ?? []).filter((item) => ["active", "trialing"].includes(item.status)).length}</strong><small>Current memberships</small></article><article className="metric-card"><span>Discord</span><strong>{profile?.discord_user_id ? "Linked" : "Connect"}</strong><small>{profile?.discord_username ?? "Needed for community roles"}</small></article><article className="metric-card"><span>Applications</span><strong>{apps?.length ?? 0}</strong><small>Recent submissions</small></article></div>
      <div id="accounts"><AccountLinks discord={profile?.discord_username ?? null} github={profile?.github_username ?? null} huggingface={profile?.huggingface_username ?? null} initialMessage={linked === "huggingface" ? "Hugging Face account linked." : linkError ? "Hugging Face account linking failed. Please try again or check OAuth configuration." : ""} /></div>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Your membership</p><h2>Subscriptions</h2></div><Link href="/pricing" className="text-button">Explore plans ↗</Link></div>
        {(subscriptions ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Plan</th><th>Status</th><th>Renewal</th><th>Billing</th></tr></thead><tbody>{subscriptions!.map((item) => <tr key={item.id}><td>{Array.isArray(item.plan) ? item.plan[0]?.name : (item.plan as { name?: string } | null)?.name ?? "Membership"}</td><td><span className="status-pill">{item.status}</span></td><td>{item.current_period_end ? new Date(item.current_period_end).toLocaleDateString() : "Lifetime"}</td><td>{item.cancel_at_period_end ? "Cancels at period end" : "Stripe managed"}</td></tr>)}</tbody></table></div> : <div className="empty-state">No subscriptions yet. <Link href="/pricing">Explore membership options</Link></div>}
      </section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Billing history</p><h2>Recent purchases</h2></div><BillingPortalButton /></div>{(payments ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments!.map((payment) => <tr key={payment.id}><td>{new Date(payment.created_at).toLocaleDateString()}</td><td>{Array.isArray(payment.plan) ? payment.plan[0]?.name : (payment.plan as { name?: string } | null)?.name ?? "Membership"}</td><td>{formatMoney(payment.amount_cents, payment.currency)}</td><td>{payment.status}</td></tr>)}</tbody></table></div> : <div className="empty-state">Verified purchases will appear here after Stripe confirms payment.</div>}</section>
    </div></div>
  </section>;
}
