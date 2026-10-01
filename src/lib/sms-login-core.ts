import { createHmac, randomInt } from "node:crypto";

export const SMS_CODE_TTL_SECONDS = 600;
export const SMS_CODE_MAX_ATTEMPTS = 5;

export function normalizeNorwegianMobile(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/[\s().-]/g, "");
  if (/^[49]\d{7}$/.test(digits)) return `+47${digits}`;
  const match = digits.match(/^(?:\+47|0047|47)([49]\d{7})$/);
  return match ? `+47${match[1]}` : null;
}

export function isLoginCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function generateLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashLoginCode(phone: string, code: string, pepper: string): string {
  return createHmac("sha256", pepper).update(`${phone}:${code}`).digest("hex");
}

export function formatNorwegianMobile(phone: string): string {
  return phone.replace(/^\+47(\d{3})(\d{2})(\d{3})$/, "+47 $1 $2 $3");
}
