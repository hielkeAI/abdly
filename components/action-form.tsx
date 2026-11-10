"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActionForm({
  endpoint,
  method = "POST",
  children,
  submitLabel,
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "The request failed.");
      setMessage(data.message ?? "Saved.");
      router.refresh();
      if (method === "POST") formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="action-form" onSubmit={submit}>{children}{message && <p className="form-message" role="status">{message}</p>}<button className="button" disabled={busy}>{busy ? "Saving…" : submitLabel}</button></form>;
}
