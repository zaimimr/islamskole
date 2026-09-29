export type RolloverClass = {
  id: string;
  name: string;
  capacity: number | null;
  price: number | null;
};

export type RolloverStudent = {
  studentId: string;
  name: string;
  age: number | null;
  familyId: string | null;
  currentClassId: string;
  proposedClassId: string | null;
  placedClassId: string | null;
  continues: boolean | null;
};

export type CapacityWarning = {
  classId: string;
  name: string;
  total: number;
  capacity: number;
};

export function nextClassId(
  classes: RolloverClass[],
  currentClassId: string,
): string | null {
  const index = classes.findIndex((item) => item.id === currentClassId);
  if (index < 0) return null;
  return classes[index + 1]?.id ?? null;
}

export function defaultChoice(student: RolloverStudent): string {
  return student.continues === false ? "" : (student.proposedClassId ?? "");
}

export function capacityWarnings(
  classes: RolloverClass[],
  existingCounts: Record<string, number>,
  choices: Record<string, string>,
): CapacityWarning[] {
  const totals = new Map<string, number>(Object.entries(existingCounts));
  for (const classId of Object.values(choices)) {
    if (!classId) continue;
    totals.set(classId, (totals.get(classId) ?? 0) + 1);
  }
  return classes
    .filter(
      (item) =>
        item.capacity != null && (totals.get(item.id) ?? 0) > item.capacity,
    )
    .map((item) => ({
      classId: item.id,
      name: item.name,
      total: totals.get(item.id) ?? 0,
      capacity: item.capacity as number,
    }));
}
