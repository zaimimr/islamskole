const PLACEHOLDER_EMAILS = new Set(["mangler@islamskole.no"]);

export function isPlaceholderEmail(email: string | null | undefined) {
  return PLACEHOLDER_EMAILS.has((email ?? "").trim().toLowerCase());
}
