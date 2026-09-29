export const RELATIONSHIP_LABELS = ["mor", "far", "foresatt", "steforelder", "verge", "annet"] as const;
export type RelationshipLabel = (typeof RELATIONSHIP_LABELS)[number];

export type FamilyGuardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  relationship_label: string | null;
  is_me: boolean;
  pending_email: string | null;
};

export type FamilyChild = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
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
  guardians: FamilyGuardian[];
  children: FamilyChild[];
  pickup: FamilyPickup[];
};
