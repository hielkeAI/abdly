"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Position = { id: string; name: string; description: string; questions: { id: string; label: string; required?: boolean }[] };

export function ApplicationForm({ positions }: { positions: Position[] }) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const position = positions.find((item) => item.id === positionId);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!positionId) return;
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const answers: Record<string, string> = {};
    for (const question of position?.questions ?? []) answers[question.id] = String(formData.get(question.id) ?? "");
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId, answers }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to submit application.");
      setMessage(result.message ?? "Application submitted.");
      formElement.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit application.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="action-form" onSubmit={submit}>
    {positions.length === 0 ? <p className="muted">Applications are not open right now.</p> : <>
      <label className="field-label">Position<select value={positionId} onChange={(event) => setPositionId(event.target.value)}>{positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {position?.description && <p className="muted">{position.description}</p>}
      {(position?.questions ?? []).map((question) => <label key={question.id} className="field-label">{question.label}<textarea name={question.id} required={question.required !== false} maxLength={4000} /></label>)}
      <button className="button" disabled={busy}>{busy ? "Submitting…" : "Submit application"} <span>↗</span></button>
    </>}
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
