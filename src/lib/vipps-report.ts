import "server-only";
import { getAccessToken, VippsHttpError, type VippsCredentials } from "@/lib/vipps";
import {
  vippsFundsItemToTransaction,
  type ParsedTransaction,
  type VippsFundsItem,
} from "@/lib/bank-statement";
import { DONATIONS_API_MSN, parseMsnList } from "@/lib/reconciliation-match";
import { mapInChunks } from "@/lib/payment-integrity";

export function vippsReportMsns(): string[] {
  return parseMsnList(process.env.VIPPS_REPORT_MSNS);
}

type ReportCredentials =
  | (VippsCredentials & { kind: "merchant" })
  | { kind: "donations"; baseUrl: string; clientId: string; clientSecret: string };

const donationTokens = new Map<string, { token: string; expiresAt: number }>();

async function donationsToken(credentials: { baseUrl: string; clientId: string; clientSecret: string }) {
  const cached = donationTokens.get(credentials.clientId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const response = await fetch(`${credentials.baseUrl}/miami/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      "Vipps-System-Name": process.env.VIPPS_SYSTEM_NAME ?? "islamskole",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new VippsHttpError(
      `Vipps token-feil (${response.status}): ${(await response.text()).slice(0, 300)}`,
      response.status,
    );
  }
  const data = (await response.json()) as { access_token: string; expires_in: number | string };
  donationTokens.set(credentials.clientId, {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  });
  return data.access_token;
}

export function vippsReportCredentials(msn: string): ReportCredentials | null {
  const baseUrl = (process.env.VIPPS_BASE_URL ?? "https://apitest.vipps.no").replace(/\/$/, "");
  const donationsId = process.env.VIPPS_DONATIONS_CLIENT_ID;
  const donationsSecret = process.env.VIPPS_DONATIONS_CLIENT_SECRET;
  if (msn === DONATIONS_API_MSN && donationsId && donationsSecret) {
    return { kind: "donations", baseUrl, clientId: donationsId, clientSecret: donationsSecret };
  }
  const clientId = process.env[`VIPPS_CLIENT_ID_${msn}`] ?? process.env.VIPPS_CLIENT_ID;
  const clientSecret =
    process.env[`VIPPS_CLIENT_SECRET_${msn}`] ?? process.env.VIPPS_CLIENT_SECRET;
  const subscriptionKey =
    process.env[`VIPPS_SUBSCRIPTION_KEY_${msn}`] ?? process.env.VIPPS_SUBSCRIPTION_KEY;
  if (!clientId || !clientSecret || !subscriptionKey) return null;
  return {
    kind: "merchant",
    baseUrl,
    clientId,
    clientSecret,
    subscriptionKey,
    merchantSerialNumber: msn,
  };
}

type FundsPage = {
  items?: VippsFundsItem[];
  cursor?: string;
  hasMore?: boolean;
  tryLater?: boolean;
};

async function reportGet<T>(
  credentials: ReportCredentials,
  path: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Vipps-System-Name": process.env.VIPPS_SYSTEM_NAME ?? "islamskole",
    "Content-Type": "application/json",
  };
  if (credentials.kind === "donations") {
    headers.Authorization = `Bearer ${await donationsToken(credentials)}`;
  } else {
    headers.Authorization = `Bearer ${await getAccessToken(credentials)}`;
    headers["Ocp-Apim-Subscription-Key"] = credentials.subscriptionKey;
    headers["Merchant-Serial-Number"] = credentials.merchantSerialNumber;
  }
  const response = await fetch(`${credentials.baseUrl}${path}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new VippsHttpError(
      `Vipps rapport-feil (${response.status}): ${body.slice(0, 300)}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

async function findLedgerId(credentials: ReportCredentials, msn: string): Promise<string | null> {
  const data = await reportGet<{
    items?: { ledgerId?: string; settlesForRecipientHandles?: string[] }[];
  }>(credentials, `/settlement/v1/ledgers?settlesForRecipientHandles=${encodeURIComponent(`NO:${msn}`)}`);
  const items = data.items ?? [];
  const exact = items.find((item) =>
    (item.settlesForRecipientHandles ?? []).some((handle) => handle.replace(/\D/g, "") === msn),
  );
  return (exact ?? items[0])?.ledgerId ?? null;
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && dates.length < 93) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export type VippsReportResult = {
  msn: string;
  transactions: ParsedTransaction[];
  error: string | null;
};

function describeError(msn: string, error: unknown): string {
  if (error instanceof VippsHttpError && (error.status === 401 || error.status === 403)) {
    return `Nøklene har ikke tilgang til rapporter for Vippsnummer ${msn}. Legg inn egne nøkler for dette salgsstedet (VIPPS_CLIENT_ID_${msn}, VIPPS_CLIENT_SECRET_${msn}, VIPPS_SUBSCRIPTION_KEY_${msn}) eller last opp eksport fra Vipps-portalen.`;
  }
  if (error instanceof VippsHttpError && error.status === 404) {
    return `Fant ingen oppgjørskonto for Vippsnummer ${msn}.`;
  }
  return `Henting for Vippsnummer ${msn} feilet: ${error instanceof Error ? error.message : "ukjent feil"}`;
}

export async function fetchVippsReport(
  msn: string,
  from: string,
  to: string,
): Promise<VippsReportResult> {
  const credentials = vippsReportCredentials(msn);
  if (!credentials) {
    return { msn, transactions: [], error: "Vipps er ikke konfigurert." };
  }
  try {
    const ledgerId = await findLedgerId(credentials, msn);
    if (!ledgerId) {
      return { msn, transactions: [], error: `Fant ingen oppgjørskonto for Vippsnummer ${msn}.` };
    }
    const transactions: ParsedTransaction[] = [];
    await mapInChunks(datesBetween(from, to), 5, async (date) => {
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams({ includeGDPRSensitiveData: "true" });
        if (cursor) query.set("cursor", cursor);
        const data = await reportGet<FundsPage>(
          credentials,
          `/report/v2/ledgers/${encodeURIComponent(ledgerId)}/funds/dates/${date}?${query}`,
        );
        for (const item of data.items ?? []) {
          const transaction = vippsFundsItemToTransaction(item, msn);
          if (transaction) transactions.push(transaction);
        }
        if (!data.hasMore || !data.cursor) break;
        cursor = data.cursor;
      }
    });
    return { msn, transactions, error: null };
  } catch (error) {
    return { msn, transactions: [], error: describeError(msn, error) };
  }
}
