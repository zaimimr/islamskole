export type NamedRecord = Partial<{
  child_first_name: string | null;
  child_last_name: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
  email: string | null;
  mother_email: string | null;
  father_email: string | null;
}>;

function joinName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  return [first, last]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .join(" ")
    .trim();
}

export function studentDisplayName(record: NamedRecord): string {
  return joinName(record.child_first_name, record.child_last_name);
}

export function motherName(record: NamedRecord): string | null {
  return joinName(record.mother_first_name, record.mother_last_name) || null;
}

export function fatherName(record: NamedRecord): string | null {
  return joinName(record.father_first_name, record.father_last_name) || null;
}

export function guardianName(record: NamedRecord): string | null {
  return motherName(record) ?? fatherName(record) ?? null;
}

export function guardianEmails(record: NamedRecord): string[] {
  return [
    ...new Set(
      [record.email, record.mother_email, record.father_email]
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim().toLowerCase()),
    ),
  ];
}
