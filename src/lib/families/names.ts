import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { familyDisplayName, type FamilyNamePerson } from "@/lib/families/naming";
import type { Database } from "@/lib/supabase/types";

export async function loadFamilyNames(
  client: SupabaseClient<Database>,
): Promise<Map<string, string>> {
  const [familyResult, guardianResult, studentResult] = await Promise.all([
    client.from("families").select("id, display_name"),
    client.from("family_guardians").select("family_id, guardian:guardians(last_name)"),
    client.from("students").select("family_id, child_last_name").not("family_id", "is", null),
  ]);

  const guardians = new Map<string, FamilyNamePerson[]>();
  for (const row of guardianResult.data ?? []) {
    const guardian = row.guardian as { last_name: string | null } | null;
    if (!guardian) continue;
    const list = guardians.get(row.family_id) ?? [];
    list.push({ lastName: guardian.last_name });
    guardians.set(row.family_id, list);
  }
  const students = new Map<string, FamilyNamePerson[]>();
  for (const row of studentResult.data ?? []) {
    if (!row.family_id) continue;
    const list = students.get(row.family_id) ?? [];
    list.push({ lastName: row.child_last_name });
    students.set(row.family_id, list);
  }

  return new Map(
    (familyResult.data ?? []).map((family) => [
      family.id,
      familyDisplayName({
        familyId: family.id,
        displayName: family.display_name,
        guardians: guardians.get(family.id) ?? [],
        students: students.get(family.id) ?? [],
      }),
    ]),
  );
}
