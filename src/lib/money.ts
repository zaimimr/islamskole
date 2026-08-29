export function formatNok(ore: number): string {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

export function kronerToOre(kroner: number): number {
  return Math.round(kroner * 100);
}
