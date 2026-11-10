import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const passwordReset = url.searchParams.get("intent") === "password_reset";
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) return NextResponse.redirect(new URL(passwordReset ? "/reset-password?error=verification" : "/login?error=profile", request.url));
      if (user) {
        const discord = user.identities?.find((identity) => identity.provider === "discord")?.identity_data;
        if (passwordReset) {
          const hasPasswordIdentity = user.identities?.some((identity) => identity.provider === "email");
          const discordId = typeof discord?.sub === "string" ? discord.sub : null;
          const admin = createAdminClient();
          const { data: profile, error: profileLookupError } = await admin.from("profiles").select("discord_user_id").eq("id", user.id).maybeSingle();
          if (profileLookupError) {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) console.error("Could not clear a password-reset session after profile lookup failed:", signOutError.message);
            return NextResponse.redirect(new URL("/reset-password?error=verification", request.url));
          }
          if (!hasPasswordIdentity || !discordId || profile?.discord_user_id !== discordId) {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) console.error("Could not clear an unverified password-reset session:", signOutError.message);
            return NextResponse.redirect(new URL("/reset-password?error=discord_not_linked", request.url));
          }
          return NextResponse.redirect(new URL("/reset-password/update", request.url));
        }
        const github = user.identities?.find((identity) => identity.provider === "github")?.identity_data;
        const profile: Record<string, unknown> = { id: user.id, email: user.email ?? null };
        if (typeof discord?.sub === "string") profile.discord_user_id = discord.sub;
        if (typeof discord?.full_name === "string") profile.discord_username = discord.full_name;
        if (typeof github?.user_name === "string") profile.github_username = github.user_name;
        if (typeof github?.preferred_username === "string") profile.github_username = github.preferred_username;
        const { error: profileError } = await createAdminClient().from("profiles").upsert(profile, { onConflict: "id" });
        if (profileError) return NextResponse.redirect(new URL("/login?error=profile", request.url));
      }
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }
  return NextResponse.redirect(new URL(passwordReset ? "/reset-password?error=verification" : "/login?error=oauth", request.url));
}
