const actionLabels: Record<string, string> = {
  "portal.family.address": "adresse",
  "portal.family.preferences": "språk for beskjeder",
  "portal.guardian.update": "foresatt",
  "portal.guardian.add": "la til foresatt",
  "portal.guardian.remove": "fjernet foresatt",
  "portal.child.update": "barnets opplysninger",
  "portal.child.health": "helse og samtykke",
  "portal.pickup.add": "la til henteperson",
  "portal.pickup.update": "henteperson",
  "portal.pickup.remove": "fjernet henteperson",
};

const fieldLabels: Record<string, string> = {
  address: "adresse",
  postal_code: "postnummer",
  city: "poststed",
  preferred_language: "språk",
  first_name: "fornavn",
  last_name: "etternavn",
  phone: "telefon",
  relationship_label: "rolle",
  receives_communication: "beskjeder",
  child_first_name: "fornavn",
  child_last_name: "etternavn",
  child_birth_date: "fødselsdato",
  child_gender: "kjønn",
  child_email: "e-post",
  child_phone: "telefon",
  child_level_quran: "nivå koran",
  child_level_arabic: "nivå arabisk",
  child_level_islam: "nivå islam",
  allergies: "allergier",
  medical_notes: "medisinske opplysninger",
  photo_consent: "fotosamtykke",
  name: "navn",
  relation: "relasjon",
};

export function describeParentChange(action: string, metadata: unknown): string {
  const label = actionLabels[action] ?? "opplysninger";
  const changes =
    metadata && typeof metadata === "object" && "changes" in metadata
      ? (metadata as { changes: unknown }).changes
      : null;
  if (!changes || typeof changes !== "object") return label;
  const fields = [...new Set(Object.keys(changes).map((key) => fieldLabels[key] ?? key))];
  return fields.length ? `${label}: ${fields.join(", ")}` : label;
}
