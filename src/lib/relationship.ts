const RELATIONSHIP_LABELS: Record<string, string> = {
  foresatt: "Foresatt",
  guardian: "Foresatt",
  mor: "Mor",
  mother: "Mor",
  far: "Far",
  father: "Far",
  steforelder: "Steforelder",
  stepparent: "Steforelder",
  verge: "Verge",
  annet: "Annen relasjon",
  other: "Annen relasjon",
};

export function relationshipLabel(role: string): string {
  return RELATIONSHIP_LABELS[role.trim().toLowerCase()] ?? role;
}

const RELATIONSHIP_KEYS: Record<string, string> = {
  guardian: "foresatt",
  mother: "mor",
  father: "far",
  stepparent: "steforelder",
  other: "annet",
};

export function relationshipKey(role: string): string {
  const key = role.trim().toLowerCase();
  return RELATIONSHIP_KEYS[key] ?? key;
}
