import Link from "next/link";
import { CheckoutButton } from "@/components/checkout-button";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
type Plan = { id: string; name: string; description: string; billing_interval: "month" | "lifetime"; amount_cents: number; currency: string };

export default async function PricingPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let plans: Plan[] = [];
  let loadError = "";
  if (configured) {
    const { data, error } = await (await createClient()).from("plans").select("id,name,description,billing_interval,amount_cents,currency").eq("active", true).order("amount_cents");
    if (error) loadError = error.message;
    else plans = (data ?? []) as Plan[];
  }
  return <section className="page-shell">
    <div className="page-heading"><p className="eyebrow">Choose your way in</p><h1>Membership, <span className="accent">your way.</span></h1><p>Every plan is managed by the AbdlyAI team. Choose the option that fits your journey.</p></div>
    {loadError ? <div className="empty-state">Pricing is temporarily unavailable: {loadError}</div> : <div className="pricing-grid">
      {plans.length ? plans.map((plan, index) => <article className={`price-card ${index === 0 ? "featured" : ""}`} key={plan.id}><p className="eyebrow">{plan.billing_interval === "lifetime" ? "One-time membership" : "Monthly membership"}</p><h2>{plan.name}</h2><p>{plan.description}</p><div className="price">{formatMoney(plan.amount_cents, plan.currency)}</div><span className="period">{plan.billing_interval === "lifetime" ? "one time · lifetime access" : "per month · cancel anytime"}</span><div style={{ marginTop: 22 }}><CheckoutButton planId={plan.id} label="Continue to secure checkout" /></div></article>) : <div className="empty-state">{configured ? "Plans are being prepared. Please check back soon." : <>Pricing is not configured yet. <Link href="/contact">Contact us</Link> for help.</>}</div>}
    </div>}
    <p className="center muted" style={{ marginTop: 25 }}>All payments are securely processed by Stripe. A Discord account is required to receive community access.</p>
  </section>;
}
