import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import type { Json } from "@/lib/supabase/types";

export async function writeAudit(entry: {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const user = await getUser();
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: (entry.metadata ?? null) as Json,
    });
  } catch (error) {
    console.error("writeAudit failed", error);
  }
}
