export type FamilyNamePerson = {
  lastName: string | null | undefined;
};

export type FamilyNameInput = {
  familyId: string;
  displayName: string | null | undefined;
  guardians: FamilyNamePerson[];
  students: FamilyNamePerson[];
};

const norwegianCollator = new Intl.Collator("nb-NO", {
  sensitivity: "base",
  usage: "sort",
});

function clean(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function stableNames(people: FamilyNamePerson[]): string[] {
  const names = new Map<string, string>();

  for (const person of people) {
    const name = clean(person.lastName);
    if (!name) continue;

    const key = name.normalize("NFKC").toLocaleLowerCase("nb-NO");
    const existing = names.get(key);
    const localized = existing
      ? norwegianCollator.compare(name, existing)
      : Number.NEGATIVE_INFINITY;
    if (!existing || localized < 0 || (localized === 0 && name < existing)) {
      names.set(key, name);
    }
  }

  return [...names.values()].sort((left, right) => {
    const localized = norwegianCollator.compare(left, right);
    if (localized) return localized;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

export function familyDisplayName(input: FamilyNameInput): string {
  const explicitName = clean(input.displayName);
  if (explicitName) return explicitName;

  const guardianNames = stableNames(input.guardians);
  const studentNames = stableNames(input.students);
  const surnames = guardianNames.length > 0 ? guardianNames : studentNames;

  if (surnames.length > 0) {
    return `Familien ${surnames.join(" / ")}`;
  }

  const shortId = input.familyId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return shortId ? `Familie ${shortId}` : "Familie";
}
