"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AccountLinks({ discord, github, huggingface, initialMessage = "" }: { discord: string | null; github: string | null; huggingface: string | null; initialMessage?: string }) {
  const [message, setMessage] = useState(initialMessage);
  async function link(provider: "discord" | "github") {
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`, scopes: provider === "discord" ? "identify email" : "read:user user:email" },
    });
    if (error) setMessage(error.message);
  }
  return (
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Connected accounts</p><h2>Your identity</h2></div></div>
      <div className="connected-list">
        <div><span>Discord</span><strong>{discord ?? "Not linked"}</strong>{!discord && <button className="text-button" onClick={() => link("discord")}>Link account ↗</button>}</div>
        <div><span>GitHub</span><strong>{github ?? "Not linked"}</strong>{!github && <button className="text-button" onClick={() => link("github")}>Link account ↗</button>}</div>
        <div><span>Hugging Face</span><strong>{huggingface ?? "Not linked"}</strong>{!huggingface && <a className="text-button" href="/api/oauth/huggingface/start">Link account ↗</a>}</div>
      </div>
      {message && <p className="form-message" role="status">{message}</p>}
    </section>
  );
}
