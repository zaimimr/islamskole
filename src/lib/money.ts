export function formatNok(ore: number): string {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

export function kronerToOre(kroner: number): number {
  return Math.round(kroner * 100);
}

export function capAtLimit(
  amount: number,
  limit: number,
): { ok: true; amount: number } | { ok: false } {
  if (limit <= 0) return { ok: false };
  if (amount <= limit) return { ok: true, amount };
  if (amount - limit < 100) return { ok: true, amount: limit };
  return { ok: false };
}
