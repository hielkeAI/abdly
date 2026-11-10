import Link from "next/link";
import { DiscordPasswordReset } from "@/components/discord-password-reset";

const errorMessages: Record<string, string> = {
  discord_not_linked: "This Discord account is not linked to an existing password account. Sign in another way or contact support.",
  verification: "We couldn’t verify your linked Discord account. Please try again.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="auth-shell"><div className="auth-aside"><p className="eyebrow">Account recovery</p><h1>Back to<br /><span className="accent">your account.</span></h1><p>Verify with the Discord account already connected to your AbdlyAI login, then choose a new password.</p><Link className="subtle-link" href="/login">← Back to log in</Link></div><div className="auth-card"><div className="reset-icon"><span aria-hidden="true">⌁</span></div><h2>Reset your password</h2><p>Password changes are protected by Discord verification.</p><DiscordPasswordReset initialMessage={error ? errorMessages[error] ?? "Discord verification could not be completed." : ""} /></div></section>;
}
