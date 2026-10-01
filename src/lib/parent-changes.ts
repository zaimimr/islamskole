import "server-only";
import { createClient } from "@/lib/supabase/server";
import { describeParentChange } from "@/lib/parent-change-summary";

export type ParentChange = {
  action: string;
  actorEmail: string | null;
  createdAt: string;
  summary: string;
};

export async function getLastParentChange(filter: { familyId: string } | { studentId: string }) {
  const supabase = await createClient();
  let request = supabase
    .from("audit_log")
    .select("action, actor_email, created_at, metadata")
    .like("action", "portal.%")
    .order("created_at", { ascending: false })
    .limit(1);
  request =
    "familyId" in filter
      ? request.eq("metadata->>family_id", filter.familyId)
      : request.eq("entity_type", "student").eq("entity_id", filter.studentId);
  const { data, error } = await request.maybeSingle();
  if (error) {
    console.error("last parent change lookup failed", error);
    return null;
  }
  if (!data) return null;
  return {
    action: data.action,
    actorEmail: data.actor_email,
    createdAt: data.created_at,
    summary: describeParentChange(data.action, data.metadata),
  } satisfies ParentChange;
}
