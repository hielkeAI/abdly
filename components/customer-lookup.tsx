"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";

type Result = {
  customer: { id: string; email: string | null; discord_username: string | null; discord_user_id: string };
  subscriptions: { id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; plan: { name: string } | { name: string }[] | null }[];
  payments: { id: string; amount_cents: number; currency: string; status: string; created_at: string; plan: { name: string } | { name: string }[] | null }[];
  discord: { username: string; roles: { id: string; name: string }[] } | null;
};

export function CustomerLookup({ staffRole }: { staffRole: "owner" | "supervisor" }) {
  const [discordId, setDiscordId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [roles, setRoles] = useState<{ role_id: string; name: string }[]>([]);
  const [roleId, setRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch(`/api/customers?discordUserId=${encodeURIComponent(discordId)}`);
      const data = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Customer lookup failed.");
      setResult(data);
      const roleResponse = await fetch("/api/owner/roles");
      if (roleResponse.ok) {
        const roleData = await roleResponse.json() as { roles: { role_id: string; name: string }[] };
        setRoles(roleData.roles);
        setRoleId(roleData.roles[0]?.role_id ?? "");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(action: "assign" | "revoke") {
    if (!result || !roleId) return;
    setMessage("");
    try {
      const response = await fetch("/api/customers/roles", { method: action === "assign" ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: result.customer.id, roleId }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Role change failed.");
      setMessage(data.message ?? "Role updated.");
      const refresh = await fetch(`/api/customers?discordUserId=${encodeURIComponent(discordId)}`);
      if (refresh.ok) setResult(await refresh.json() as Result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Role change failed.");
    }
  }

  return <section className="panel" id="customers"><div className="panel-heading"><div><p className="eyebrow">Customer support</p><h2>Find a customer</h2></div></div>
    <form className="action-form" onSubmit={search}><label className="field-label">Discord user ID<input value={discordId} onChange={(event) => setDiscordId(event.target.value)} inputMode="numeric" pattern="[0-9]{17,20}" required placeholder="17–20 digit Discord user ID" /></label><button className="button" disabled={busy}>{busy ? "Searching…" : "Search customer"} <span>⌕</span></button></form>
    {message && <p className="form-message" role="status" style={{ marginTop: 12 }}>{message}</p>}
    {result && <div style={{ marginTop: 24 }}>
      <div className="metrics-grid"><article className="metric-card"><span>Customer</span><strong>{result.customer.discord_username ?? result.discord?.username ?? "Discord member"}</strong><small>{result.customer.email ?? "No email"}</small></article><article className="metric-card"><span>Discord roles</span><strong>{result.discord?.roles.length ?? 0}</strong><small>{result.discord ? result.discord.roles.map((role) => role.name).join(", ") || "No roles" : "Not in configured server"}</small></article><article className="metric-card"><span>Subscriptions</span><strong>{result.subscriptions.filter((item) => ["active", "trialing"].includes(item.status)).length}</strong><small>Active memberships</small></article><article className="metric-card"><span>Purchases</span><strong>{result.payments.length}</strong><small>Verified payments</small></article></div>
      <div className="panel" style={{ marginTop: 14 }}><div className="panel-heading"><h3>Purchase history</h3></div>{result.payments.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead><tbody>{result.payments.map((payment) => <tr key={payment.id}><td>{new Date(payment.created_at).toLocaleDateString()}</td><td>{Array.isArray(payment.plan) ? payment.plan[0]?.name : payment.plan?.name ?? "Membership"}</td><td>{formatMoney(payment.amount_cents, payment.currency)}</td><td>{payment.status}</td></tr>)}</tbody></table></div> : <p className="muted">No verified purchases.</p>}</div>
      <div className="panel" style={{ marginTop: 14 }}><div className="panel-heading"><h3>Manual Discord role management</h3></div><div className="action-form"><label className="field-label">Managed role<select value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Select a configured role</option>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></label><div className="oauth-row"><button type="button" className="button" disabled={!roleId} onClick={() => changeRole("assign")}>Assign role</button><button type="button" className="button button-quiet" disabled={!roleId} onClick={() => changeRole("revoke")}>Revoke role</button></div><p className="muted">{staffRole === "owner" ? "Owner action, recorded in the audit log." : "Supervisor role changes are recorded in the audit log."}</p></div></div>
    </div>}
  </section>;
}
