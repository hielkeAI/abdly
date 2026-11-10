import { NextResponse } from "next/server";

export function errorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  return NextResponse.json({ error: message }, { status });
}

export function isAuthorized(role: string, allowed: string[]) {
  return allowed.includes(role);
}
