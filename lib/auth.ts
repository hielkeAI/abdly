import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountRole = "customer" | "supervisor" | "owner";
export type Actor = { user: User; role: AccountRole; email: string | null };

export async function getActor(): Promise<Actor | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const email = user.email?.toLowerCase() ?? null;
  const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const admin = createAdminClient();
  if (email && owners.includes(email)) {
    const { error: ownerError } = await admin.from("profiles").upsert(
      { id: user.id, email, role: "owner" },
      { onConflict: "id" },
    );
    if (ownerError) throw new Error(`Unable to provision owner profile: ${ownerError.message}`);
  }

  const { data: profile, error: profileError } = await admin.from("profiles").select("role,email").eq("id", user.id).single();
  if (profileError) throw new Error(`Unable to load account permissions: ${profileError.message}`);
  return { user, role: profile.role as AccountRole, email: profile.email };
}

export async function requireActor(roles?: AccountRole[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (roles && !roles.includes(actor.role)) redirect("/dashboard");
  return actor;
}
