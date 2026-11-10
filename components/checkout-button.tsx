"use client";

import Link from "next/link";
import { useState } from "react";

export function CheckoutButton({ planId, label = "Choose plan" }: { planId: string; label?: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  async function checkout() {
    setBusy(true);
    setError("");
    setSignInRequired(false);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json() as { url?: string; error?: string };
      if (response.status === 401) setSignInRequired(true);
      if (!response.ok) throw new Error(data.error ?? "Unable to start checkout.");
      if (!data.url) throw new Error("Stripe did not return a checkout URL.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start checkout.");
      setBusy(false);
    }
  }
  return <><button className="button button-wide" onClick={checkout} disabled={busy}>{busy ? "Connecting to Stripe…" : label} <span>↗</span></button>{error && <p className="form-message">{error}{signInRequired && <> <Link href="/login">Log in</Link> or <Link href="/register">create an account</Link>.</>}</p>}</>;
}
