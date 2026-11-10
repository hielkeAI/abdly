import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/auth";
import { requiredEnv } from "@/lib/config";

export async function GET(request: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.redirect(new URL("/login", request.url));
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://huggingface.co/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requiredEnv("HUGGINGFACE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/api/oauth/huggingface/callback`);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  const response = NextResponse.redirect(url);
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  response.cookies.set("hf_oauth_state", state, options);
  response.cookies.set("hf_oauth_verifier", verifier, options);
  return response;
}
