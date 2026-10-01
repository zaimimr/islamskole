import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function smsEnabled(): boolean {
  return Boolean(
    process.env.SMS_OUTBOX_DIR || (process.env.SVEVE_USER && process.env.SVEVE_PASSWD),
  );
}

async function writeOutbox(dir: string, message: { to: string; text: string }) {
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("SMS outbox write failed", error);
    return false;
  }
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  const outbox = process.env.SMS_OUTBOX_DIR;
  if (outbox) return await writeOutbox(outbox, { to, text });

  const user = process.env.SVEVE_USER;
  const passwd = process.env.SVEVE_PASSWD;
  if (!user || !passwd) return false;

  const url = new URL("https://sveve.no/SMS/SendMessage");
  url.searchParams.set("user", user);
  url.searchParams.set("passwd", passwd);
  url.searchParams.set("to", to);
  url.searchParams.set("msg", text);
  url.searchParams.set("from", process.env.SVEVE_SENDER || "Islamskole");
  url.searchParams.set("f", "json");

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = (await response.json().catch(() => null)) as {
      response?: { msgOkCount?: number; fatalError?: string; errors?: unknown };
    } | null;
    if (!response.ok || !body?.response?.msgOkCount) {
      console.error("Sveve SMS failed", response.status, body?.response?.fatalError ?? body?.response?.errors);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Sveve SMS failed", error);
    return false;
  }
}
