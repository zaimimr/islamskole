import "server-only";
import { getAccessToken, VippsHttpError, type VippsCredentials } from "@/lib/vipps";
import { vippsExternalId, type ParsedTransaction } from "@/lib/bank-statement";
import { parseMsnList } from "@/lib/reconciliation-match";

export function vippsReportMsns(): string[] {
  return parseMsnList(process.env.VIPPS_REPORT_MSNS);
}

export function vippsReportCredentials(msn: string): VippsCredentials | null {
  const clientId = process.env[`VIPPS_CLIENT_ID_${msn}`] ?? process.env.VIPPS_CLIENT_ID;
  const clientSecret =
    process.env[`VIPPS_CLIENT_SECRET_${msn}`] ?? process.env.VIPPS_CLIENT_SECRET;
  const subscriptionKey =
    process.env[`VIPPS_SUBSCRIPTION_KEY_${msn}`] ?? process.env.VIPPS_SUBSCRIPTION_KEY;
  if (!clientId || !clientSecret || !subscriptionKey) return null;
  return {
    baseUrl: (process.env.VIPPS_BASE_URL ?? "https://apitest.vipps.no").replace(/\/$/, ""),
    clientId,
    clientSecret,
    subscriptionKey,
    merchantSerialNumber: msn,
  };
}

type FundsItem = {
  pspReference?: string;
  time?: string;
  ledgerDate?: string;
  entryType?: string;
  reference?: string;
  currency?: string;
  amount?: number;
  recipientHandle?: string;
  message?: string;
  name?: string;
  maskedPhoneNo?: string;
};

type FundsPage = {
  items?: FundsItem[];
  cursor?: string;
  hasMore?: boolean;
  tryLater?: boolean;
};

async function reportGet<T>(
  credentials: VippsCredentials,
  path: string,
): Promise<T> {
  const token = await getAccessToken(credentials);
  const response = await fetch(`${credentials.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": credentials.subscriptionKey,
      "Merchant-Serial-Number": credentials.merchantSerialNumber,
      "Vipps-System-Name": process.env.VIPPS_SYSTEM_NAME ?? "islamskole",
      "Content-Type": "application/json",
    },
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

async function findLedgerId(credentials: VippsCredentials, msn: string): Promise<string | null> {
  const data = await reportGet<{
    items?: { ledgerId?: string; settlesForRecipientHandles?: string[] }[];
  }>(credentials, `/settlement/v1/ledgers?settlesForRecipientHandles=${encodeURIComponent(`NO:${msn}`)}`);
  const items = data.items ?? [];
  const exact = items.find((item) =>
    (item.settlesForRecipientHandles ?? []).some((handle) => handle.replace(/\D/g, "") === msn),
  );
  return (exact ?? items[0])?.ledgerId ?? null;
}

export function fundsItemToTransaction(item: FundsItem, msn: string): ParsedTransaction | null {
  const kind =
    item.entryType === "capture" ? "capture" : item.entryType === "refund" ? "refund" : null;
  if (!kind || !item.amount || !item.ledgerDate) return null;
  const amount = kind === "refund" ? -Math.abs(item.amount) : Math.abs(item.amount);
  const handleMsn = item.recipientHandle?.replace(/\D/g, "");
  return {
    source: "vipps",
    account: handleMsn || msn,
    externalId: vippsExternalId(
      kind,
      item.pspReference ?? null,
      item.reference ?? null,
      JSON.stringify(item),
    ),
    bookedOn: item.ledgerDate,
    bookedAt: item.time ?? null,
    amount,
    currency: item.currency ?? "NOK",
    counterpartyName: item.name?.trim() || null,
    counterpartyPhone: item.maskedPhoneNo?.trim() || null,
    message: item.message?.trim() || null,
    reference: item.reference ?? null,
    pspReference: item.pspReference ?? null,
    entryType: kind,
    raw: Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, String(value ?? "")]),
    ),
  };
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
    for (const date of datesBetween(from, to)) {
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams({ includeGDPRSensitiveData: "true" });
        if (cursor) query.set("cursor", cursor);
        const data = await reportGet<FundsPage>(
          credentials,
          `/report/v2/ledgers/${encodeURIComponent(ledgerId)}/funds/dates/${date}?${query}`,
        );
        for (const item of data.items ?? []) {
          const transaction = fundsItemToTransaction(item, msn);
          if (transaction) transactions.push(transaction);
        }
        if (!data.hasMore || !data.cursor) break;
        cursor = data.cursor;
      }
    }
    return { msn, transactions, error: null };
  } catch (error) {
    return { msn, transactions: [], error: describeError(msn, error) };
  }
}
