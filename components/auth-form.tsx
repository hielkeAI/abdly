"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProviderIcon } from "@/components/provider-icon";

export function AuthForm({ mode, initialMessage = "" }: { mode: "login" | "register"; initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const result = mode === "register"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "register" && !result.data.session) {
        setMessage("Check your inbox to confirm your email before signing in.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "discord" | "github" | "google") {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const result = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          ...(provider === "discord" ? { scopes: "identify email" } : provider === "github" ? { scopes: "read:user user:email" } : {}),
        },
      });
      if (result.error) throw result.error;
      if (result.data.url) window.location.assign(result.data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start OAuth sign-in.");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="button button-wide" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create your account" : "Log in"} <span>↗</span></button>
      <div className="divider"><span>or continue with</span></div>
      <div className="oauth-row">
        <button type="button" className="button button-quiet" onClick={() => oauth("discord")} disabled={busy}><ProviderIcon provider="discord" /> Discord</button>
        <button type="button" className="button button-quiet" onClick={() => oauth("github")} disabled={busy}><ProviderIcon provider="github" /> GitHub</button>
        <button type="button" className="button button-quiet" onClick={() => oauth("google")} disabled={busy}><ProviderIcon provider="google" /> Google</button>
      </div>
      <p className="muted center">Hugging Face can be linked after you sign in.</p>
      <p className="center muted">{mode === "register" ? "Already have an account? " : "New to AbdlyAI? "}<Link href={mode === "register" ? "/login" : "/register"}>{mode === "register" ? "Log in" : "Create an account"}</Link></p>
    </form>
  );
}
