import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function PurchaseSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const actor = await requireActor();
  const { session_id: sessionId } = await searchParams;
  let verified = false;
  let verificationMessage = "";
  if (sessionId && sessionId.startsWith("cs_")) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      verified = session.payment_status === "paid" &&
        (session.client_reference_id === actor.user.id || session.metadata?.user_id === actor.user.id);
      if (!verified) verificationMessage = "Stripe has not confirmed a paid checkout for this signed-in account. No access is granted from this page.";
    } catch (error) {
      verificationMessage = error instanceof Error ? `We could not verify the checkout with Stripe: ${error.message}` : "We could not verify the checkout with Stripe.";
    }
  } else verificationMessage = "A valid Stripe Checkout session is required to verify this purchase.";
  return <section className="page-shell">
    <article className="success-card">
      <div className={verified ? "success-check" : "feature-icon"}>{verified ? "✓" : "…"}</div>
      <p className="eyebrow" style={{ justifyContent: "center" }}>{verified ? "Payment confirmed" : "Payment verification"}</p>
      <h1>{verified ? <>You&apos;re <span className="accent">in.</span></> : <>We&apos;re checking<br /><span className="accent">your payment.</span></>}</h1>
      <p className="section-copy" style={{ margin: "0 auto 25px" }}>{verified ? "Stripe has confirmed your payment. Your Discord membership role is processed separately by our verified webhook. Join the community while we finish syncing your access." : verificationMessage}</p>
      {verified ? <a className="button" href="https://discord.gg/ZgkSePVHw" target="_blank" rel="noreferrer">JOIN OUR DISCORD <span>↗</span></a> : <Link className="button" href="/dashboard">Open dashboard</Link>}
      <p className="muted" style={{ marginTop: 20 }}>Need help? <Link href="/contact">Contact AbdlyAI</Link></p>
    </article>
  </section>;
}
