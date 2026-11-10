import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const initialMessage = error
    ? error === "profile"
      ? "Your account was authenticated, but its profile could not be saved. Please contact support."
      : "OAuth sign-in could not be completed. Check the provider configuration and try again."
    : "";
  return <section className="auth-shell"><div className="auth-aside"><p className="eyebrow">Welcome back</p><h1>Your next idea<br /><span className="accent">is waiting.</span></h1><p>Sign in to pick up where you left off and get back to building.</p><Link className="subtle-link" href="/">← Back to AbdlyAI</Link></div><div className="auth-card"><h2>Log in</h2><p>Enter your details to access your account.</p><AuthForm mode="login" initialMessage={initialMessage} /><Link className="forgot-link" href="/reset-password">Forgot your password? Verify with Discord ↗</Link></div></section>;
}
