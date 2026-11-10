import Link from "next/link";
import { ApplicationForm } from "@/components/application-form";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireActor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const actor = await requireActor();
  const admin = createAdminClient();
  const [{ data: positions }, { data: applications }] = await Promise.all([
    admin.from("application_positions").select("id,name,description,questions").eq("active", true).order("name"),
    admin.from("applications").select("id,position,status,reviewer_note,created_at").eq("user_id", actor.user.id).order("created_at", { ascending: false }),
  ]);
  return <section className="dashboard-shell"><div className="dashboard-top"><div><p className="eyebrow">Community opportunities</p><h1>Applications</h1><p>Share what you bring. Track your application here.</p></div><Link href="/dashboard" className="text-button">Back to dashboard ↗</Link></div><div className="dashboard-layout"><DashboardNav role="customer" /><div className="dashboard-main">
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Open positions</p><h2>Apply to join the team</h2></div></div><ApplicationForm positions={(positions ?? []) as { id: string; name: string; description: string; questions: { id: string; label: string; required?: boolean }[] }[]} /></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Your submissions</p><h2>Application status</h2></div></div>{(applications ?? []).length ? <div className="table-wrap"><table><thead><tr><th>Position</th><th>Submitted</th><th>Status</th><th>Reviewer note</th></tr></thead><tbody>{applications!.map((application) => <tr key={application.id}><td>{application.position}</td><td>{new Date(application.created_at).toLocaleDateString()}</td><td><span className={`status-pill ${application.status}`}>{application.status}</span></td><td>{application.reviewer_note ?? "—"}</td></tr>)}</tbody></table></div> : <div className="empty-state">You haven&apos;t submitted an application yet.</div>}</section>
  </div></div></section>;
}
