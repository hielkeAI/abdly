import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/new-password-form";
import { getActor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const actor = await getActor();
  if (!actor) redirect("/reset-password?error=verification");

  const discord = actor.user.identities?.find((identity) => identity.provider === "discord")?.identity_data;
  const hasPasswordIdentity = actor.user.identities?.some((identity) => identity.provider === "email");
  const discordId = typeof discord?.sub === "string" ? discord.sub : null;
  const { data: profile, error } = await createAdminClient().from("profiles").select("discord_user_id").eq("id", actor.user.id).maybeSingle();
  if (error) throw new Error(`Unable to verify linked Discord account: ${error.message}`);
  if (!hasPasswordIdentity || !discordId || profile?.discord_user_id !== discordId) redirect("/reset-password?error=discord_not_linked");

  return <section className="auth-shell"><div className="auth-aside"><p className="eyebrow">Discord verified</p><h1>One last<br /><span className="accent">thing.</span></h1><p>Your linked Discord account is confirmed. Choose a new password for your AbdlyAI login.</p></div><div className="auth-card"><div className="reset-icon"><span aria-hidden="true">✓</span></div><h2>Choose a new password</h2><p>Use at least 8 characters.</p><NewPasswordForm /></div></section>;
}
