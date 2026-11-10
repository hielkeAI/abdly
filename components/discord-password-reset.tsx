"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProviderIcon } from "@/components/provider-icon";

export function DiscordPasswordReset({ initialMessage = "" }: { initialMessage?: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);

  async function verifyWithDiscord() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error, data } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update&intent=password_reset`,
          scopes: "identify email",
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Discord did not provide a verification URL.");
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Discord verification.");
      setBusy(false);
    }
  }

  return <div className="auth-form">
    <p className="reset-privacy">We’ll verify the Discord account already linked to your AbdlyAI login. No password-reset email is sent. If Discord isn’t linked to your account, contact support.</p>
    <button className="button button-wide button-discord" type="button" onClick={verifyWithDiscord} disabled={busy}><ProviderIcon provider="discord" />{busy ? "Opening Discord…" : "Verify with Discord"}</button>
    {message && <p className="form-message" role="status">{message}</p>}
  </div>;
}
