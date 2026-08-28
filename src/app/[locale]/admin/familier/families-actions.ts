"use server";

import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

type FamilyActionResult = { ok: true } | { ok: false; error: string };

const roles = new Set([
  "foresatt",
  "mor",
  "far",
  "steforelder",
  "verge",
  "annet",
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateFamilyRelationships(
  familyId: string,
  formData: FormData,
): Promise<FamilyActionResult> {
  if (!(await getIsAdmin())) return { ok: false, error: "Ikke autorisert" };

  const keys = Array.from(
    new Set(
      read(formData, "guardian_keys")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
  const primaryKey = read(formData, "primary_guardian_key");
  if (keys.length === 0 || !keys.includes(primaryKey)) {
    return { ok: false, error: "Velg minst én foresatt og en primær kontakt" };
  }

  const guardians = keys.map((key) => ({
    key,
    id: read(formData, `guardian_${key}_id`) || null,
    first_name: read(formData, `guardian_${key}_first_name`),
    last_name: read(formData, `guardian_${key}_last_name`),
    email: read(formData, `guardian_${key}_email`) || null,
    phone: read(formData, `guardian_${key}_phone`) || null,
    role: read(formData, `guardian_${key}_role`),
  }));

  for (const guardian of guardians) {
    if (!guardian.first_name && !guardian.last_name) {
      return { ok: false, error: "Alle foresatte må ha et navn" };
    }
    if (!roles.has(guardian.role)) {
      return { ok: false, error: "Velg en gyldig relasjon for alle foresatte" };
    }
    if (guardian.email && !emailPattern.test(guardian.email)) {
      return { ok: false, error: "Skriv inn en gyldig e-postadresse" };
    }
  }

  guardians.sort((left, right) => {
    if (left.key === primaryKey) return -1;
    if (right.key === primaryKey) return 1;
    return keys.indexOf(left.key) - keys.indexOf(right.key);
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_family_relationships", {
    p_family_id: familyId,
    p_family: {
      display_name: read(formData, "display_name") || null,
      address: read(formData, "address") || null,
      postal_code: read(formData, "postal_code") || null,
      city: read(formData, "city") || null,
    },
    p_guardians: guardians.map((guardian) => ({
      id: guardian.id,
      first_name: guardian.first_name,
      last_name: guardian.last_name,
      email: guardian.email,
      phone: guardian.phone,
      role: guardian.role,
    })),
    p_resolve_reviews: formData.get("resolve_reviews") === "on",
  });

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "family.relationships_updated",
    entityType: "family",
    entityId: familyId,
    metadata: { guardianCount: guardians.length },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
