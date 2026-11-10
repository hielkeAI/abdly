"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setSaved(true);
      setMessage("Your password has been updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t update your password.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) return <div className="auth-form"><p className="form-success" role="status">{message}</p><Link className="button button-wide" href="/dashboard">Continue to AbdlyAI <span>↗</span></Link></div>;

  return <form className="auth-form" onSubmit={submit}>
    <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
    <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter it again" /></label>
    {message && <p className="form-message" role="status">{message}</p>}
    <button className="button button-wide" disabled={busy}>{busy ? "Updating password…" : "Set new password"} <span>↗</span></button>
  </form>;
}
