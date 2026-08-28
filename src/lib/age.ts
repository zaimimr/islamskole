export function schoolYearStart(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export function ageInYear(
  birthDate: string | null | undefined,
  year: number,
): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const age = year - birth.getFullYear();
  return age >= 0 ? age : null;
}

export function formatAge(
  birthDate: string | null | undefined,
  year: number,
): string {
  const age = ageInYear(birthDate, year);
  return age != null ? String(age) : "-";
}
