export const RELATIONSHIP_LABELS = ["mor", "far", "foresatt", "steforelder", "verge", "annet"] as const;
export type RelationshipLabel = (typeof RELATIONSHIP_LABELS)[number];
export const GENDERS = ["gutt", "jente"] as const;
export const LEVELS = ["nybegynner", "litt", "middels", "god"] as const;
export const LANGUAGES = ["no", "en"] as const;

export type FamilyGuardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  relationship_label: string | null;
  receives_communication: boolean;
  is_me: boolean;
  pending_email: string | null;
};

export type FamilyChild = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  level_quran: string | null;
  level_arabic: string | null;
  level_islam: string | null;
  allergies: string | null;
  medical_notes: string | null;
  photo_consent: boolean | null;
  health_updated_at: string | null;
  continues_next_year: boolean | null;
  active_this_year: boolean;
};

export type FamilyPickup = {
  id: string;
  name: string;
  phone: string | null;
  relation: string | null;
};

export type PortalFamily = {
  id: string;
  display_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  preferred_language: string | null;
  guardians: FamilyGuardian[];
  children: FamilyChild[];
  pickup: FamilyPickup[];
};

export function isValidPhone(value: string) {
  return /^\+?\d{8,15}$/.test(value.replace(/[\s-]/g, ""));
}
