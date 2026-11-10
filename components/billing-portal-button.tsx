"use client";

import { useState } from "react";

export function BillingPortalButton() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function openPortal() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to open billing portal.");
      if (!result.url) throw new Error("Stripe did not return a billing portal URL.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open billing portal.");
      setBusy(false);
    }
  }
  return <div><button className="button button-quiet" onClick={openPortal} disabled={busy}>{busy ? "Opening Stripe…" : "Manage billing"}</button>{message && <p className="form-message">{message}</p>}</div>;
}
