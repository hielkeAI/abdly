"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ModerationForm({
  endpoint,
  payload,
  label,
  quiet = false,
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  label: string;
  quiet?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setMessage(data.message ?? "Updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return <div><button className={quiet ? "button button-quiet" : "button"} onClick={submit} disabled={busy}>{busy ? "Saving…" : label}</button>{message && <small className="muted" style={{ display: "block" }}>{message}</small>}</div>;
}
