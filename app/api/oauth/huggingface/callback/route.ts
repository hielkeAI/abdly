import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requiredEnv } from "@/lib/config";

function redirectError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(code)}`, request.url));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("hf_oauth_state")?.value;
  const verifier = request.cookies.get("hf_oauth_verifier")?.value;
  if (!code || !state || !cookieState || state !== cookieState || !verifier) return redirectError(request, "huggingface_state");

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.redirect(new URL("/login", request.url));
  try {
    const tokenResponse = await fetch("https://huggingface.co/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? url.origin}/api/oauth/huggingface/callback`,
        client_id: requiredEnv("HUGGINGFACE_CLIENT_ID"),
        client_secret: requiredEnv("HUGGINGFACE_CLIENT_SECRET"),
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error(`Hugging Face token exchange failed (${tokenResponse.status}).`);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Hugging Face did not return an access token.");
    const userResponse = await fetch("https://huggingface.co/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) throw new Error(`Hugging Face profile lookup failed (${userResponse.status}).`);
    const identity = await userResponse.json() as { preferred_username?: string; name?: string; sub?: string };
    const username = identity.preferred_username ?? identity.name ?? identity.sub;
    if (!username) throw new Error("Hugging Face profile did not include a username.");
    const { error } = await createAdminClient().from("profiles").update({ huggingface_username: username }).eq("id", user.id);
    if (error) throw new Error(`Unable to save Hugging Face account link: ${error.message}`);
    const response = NextResponse.redirect(new URL("/dashboard?linked=huggingface", request.url));
    response.cookies.delete("hf_oauth_state");
    response.cookies.delete("hf_oauth_verifier");
    return response;
  } catch (error) {
    console.error(error);
    return redirectError(request, "huggingface_link");
  }
}
