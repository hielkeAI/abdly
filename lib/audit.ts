import { createAdminClient } from "@/lib/supabase/admin";

export async function audit(action: string, actorId: string | null, targetUserId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await createAdminClient().from("activity_logs").insert({
    action,
    actor_id: actorId,
    target_user_id: targetUserId,
    details,
  });
  if (error) throw new Error(`Unable to write audit log: ${error.message}`);
}
