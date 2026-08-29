import "server-only";
import {
  vippsIdempotencyKey,
  type PaymentProviderState,
} from "@/lib/payment-integrity";

type VippsConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  subscriptionKey: string;
  merchantSerialNumber: string;
  systemName: string;
};

function getConfig(): VippsConfig {
  const baseUrl = process.env.VIPPS_BASE_URL ?? "https://apitest.vipps.no";
  const clientId = process.env.VIPPS_CLIENT_ID;
  const clientSecret = process.env.VIPPS_CLIENT_SECRET;
  const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY;
  const merchantSerialNumber = process.env.VIPPS_MSN;

  if (!clientId || !clientSecret || !subscriptionKey || !merchantSerialNumber) {
    throw new Error(
      "Vipps er ikke konfigurert. Mangler en eller flere av: VIPPS_CLIENT_ID, VIPPS_CLIENT_SECRET, VIPPS_SUBSCRIPTION_KEY, VIPPS_MSN.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    clientId,
    clientSecret,
    subscriptionKey,
    merchantSerialNumber,
    systemName: process.env.VIPPS_SYSTEM_NAME ?? "islamskole",
  };
}

export function isVippsConfigured() {
  return Boolean(
    process.env.VIPPS_CLIENT_ID &&
      process.env.VIPPS_CLIENT_SECRET &&
      process.env.VIPPS_SUBSCRIPTION_KEY &&
      process.env.VIPPS_MSN,
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: VippsConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const response = await fetch(`${config.baseUrl}/accesstoken/get`, {
    method: "POST",
    headers: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vipps token-feil (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: string | number;
  };
  const expiresInSeconds = Number(data.expires_in) || 3600;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  return data.access_token;
}

function baseHeaders(config: VippsConfig, token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    "Merchant-Serial-Number": config.merchantSerialNumber,
    "Vipps-System-Name": config.systemName,
    "Content-Type": "application/json",
  };
}

export type VippsOrderLine = {
  name: string;
  id: string;
  totalAmount: number;
};

export type CreatePaymentInput = {
  reference: string;
  amount: number;
  description: string;
  returnUrl: string;
  phoneNumber?: string | null;
  metadata?: Record<string, string> | null;
  orderLines?: VippsOrderLine[] | null;
};

export type CreatePaymentResult = {
  reference: string;
  redirectUrl: string;
};

const DESCRIPTION_MAX = 100;
const METADATA_MAX_ENTRIES = 5;
const METADATA_KEY_MAX = 100;
const METADATA_VALUE_MAX = 500;

export function truncateDescription(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= DESCRIPTION_MAX) return trimmed;
  return `${trimmed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

function sanitizeMetadata(
  metadata: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!metadata) return null;
  const entries = Object.entries(metadata)
    .filter(([key, value]) => key && value)
    .slice(0, METADATA_MAX_ENTRIES)
    .map(([key, value]) => [
      key.slice(0, METADATA_KEY_MAX),
      value.slice(0, METADATA_VALUE_MAX),
    ]);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function buildReceipt(orderLines: VippsOrderLine[]) {
  return {
    orderLines: orderLines.map((line) => ({
      name: line.name.slice(0, 100),
      id: line.id.slice(0, 100),
      totalAmount: line.totalAmount,
      totalAmountExcludingTax: line.totalAmount,
      totalTaxAmount: 0,
      taxPercentage: 0,
    })),
    bottomLine: { currency: "NOK" },
  };
}

export async function createPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const normalizedPhone = input.phoneNumber
    ? input.phoneNumber.replace(/\D/g, "")
    : null;

  const body: Record<string, unknown> = {
    amount: { currency: "NOK", value: input.amount },
    paymentMethod: { type: "WALLET" },
    reference: input.reference,
    returnUrl: input.returnUrl,
    userFlow: "WEB_REDIRECT",
    paymentDescription: truncateDescription(input.description),
  };

  if (normalizedPhone && normalizedPhone.length >= 10) {
    body.customer = { phoneNumber: normalizedPhone };
  }

  const metadata = sanitizeMetadata(input.metadata);
  if (metadata) body.metadata = metadata;

  if (input.orderLines && input.orderLines.length > 0) {
    body.receipt = buildReceipt(input.orderLines);
  }

  if (process.env.VIPPS_REQUEST_PROFILE === "true") {
    body.profile = { scope: "name phoneNumber email" };
  }

  const response = await fetch(`${config.baseUrl}/epayment/v1/payments`, {
    method: "POST",
    headers: {
      ...baseHeaders(config, token),
      "Idempotency-Key": vippsIdempotencyKey("create", input.reference),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps create-feil (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    reference: string;
    redirectUrl: string;
  };
  return { reference: data.reference, redirectUrl: data.redirectUrl };
}

export type VippsPaymentState = PaymentProviderState;

export type GetPaymentResult = {
  state: VippsPaymentState;
  authorizedAmount: number;
  capturedAmount: number;
  refundedAmount: number;
  payerName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  paymentMethodType: string | null;
  pspReference: string | null;
  metadata: Record<string, string> | null;
};

export async function getPayment(
  reference: string,
): Promise<GetPaymentResult> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(
    `${config.baseUrl}/epayment/v1/payments/${encodeURIComponent(reference)}`,
    { headers: baseHeaders(config, token), cache: "no-store" },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps get-feil (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    state: VippsPaymentState;
    aggregate?: {
      authorizedAmount?: { value?: number };
      capturedAmount?: { value?: number };
      refundedAmount?: { value?: number };
    };
    paymentMethod?: { type?: string };
    pspReference?: string;
    metadata?: Record<string, string>;
    userDetails?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      mobileNumber?: string;
    };
  };

  const details = data.userDetails;
  const payerName =
    [details?.firstName, details?.lastName]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .trim() || null;

  return {
    state: data.state,
    authorizedAmount: data.aggregate?.authorizedAmount?.value ?? 0,
    capturedAmount: data.aggregate?.capturedAmount?.value ?? 0,
    refundedAmount: data.aggregate?.refundedAmount?.value ?? 0,
    payerName,
    payerEmail: details?.email ?? null,
    payerPhone: details?.mobileNumber ?? null,
    paymentMethodType: data.paymentMethod?.type ?? null,
    pspReference: data.pspReference ?? null,
    metadata: data.metadata ?? null,
  };
}

export type VippsPaymentEvent = {
  name: string;
  amount: number | null;
  timestamp: string;
  success: boolean | null;
  pspReference: string | null;
  idempotencyKey: string | null;
};

export async function getPaymentEvents(
  reference: string,
): Promise<VippsPaymentEvent[]> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(
    `${config.baseUrl}/epayment/v1/payments/${encodeURIComponent(reference)}/events`,
    { headers: baseHeaders(config, token), cache: "no-store" },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps events-feil (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as Array<{
    name?: string;
    amount?: { value?: number };
    timestamp?: string;
    success?: boolean;
    pspReference?: string;
    idempotencyKey?: string;
  }>;

  return (Array.isArray(data) ? data : [])
    .filter((event) => event.name && event.timestamp)
    .map((event) => ({
      name: event.name as string,
      amount: event.amount?.value ?? null,
      timestamp: event.timestamp as string,
      success: typeof event.success === "boolean" ? event.success : null,
      pspReference: event.pspReference ?? null,
      idempotencyKey: event.idempotencyKey ?? null,
    }));
}

export type VippsWebhook = { id: string; url: string; events: string[] };

export async function listWebhooks(): Promise<VippsWebhook[]> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(`${config.baseUrl}/webhooks/v1/webhooks`, {
    headers: baseHeaders(config, token),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps webhooks-feil (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { webhooks?: VippsWebhook[] };
  return data.webhooks ?? [];
}

export async function registerWebhook(
  url: string,
  events: string[],
): Promise<{ id: string; secret: string }> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(`${config.baseUrl}/webhooks/v1/webhooks`, {
    method: "POST",
    headers: baseHeaders(config, token),
    body: JSON.stringify({ url, events }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Vipps webhook-registrering feilet (${response.status}): ${errorBody}`,
    );
  }

  return (await response.json()) as { id: string; secret: string };
}

export async function deleteWebhook(id: string): Promise<void> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(
    `${config.baseUrl}/webhooks/v1/webhooks/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: baseHeaders(config, token), cache: "no-store" },
  );

  if (!response.ok && response.status !== 404) {
    const errorBody = await response.text();
    throw new Error(`Vipps webhook-sletting feilet (${response.status}): ${errorBody}`);
  }
}

export async function refundPayment(
  reference: string,
  amount: number,
): Promise<void> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(
    `${config.baseUrl}/epayment/v1/payments/${encodeURIComponent(reference)}/refund`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(config, token),
        "Idempotency-Key": vippsIdempotencyKey(
          "refund",
          reference,
          amount,
        ),
      },
      body: JSON.stringify({
        modificationAmount: { currency: "NOK", value: amount },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps refund-feil (${response.status}): ${errorBody}`);
  }
}

export async function cancelPayment(reference: string): Promise<void> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(
    `${config.baseUrl}/epayment/v1/payments/${encodeURIComponent(reference)}/cancel`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(config, token),
        "Idempotency-Key": vippsIdempotencyKey("cancel", reference),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps cancel-feil (${response.status}): ${errorBody}`);
  }
}

export async function capturePayment(
  reference: string,
  amount: number,
): Promise<void> {
  const config = getConfig();
  const token = await getAccessToken(config);

  const response = await fetch(
    `${config.baseUrl}/epayment/v1/payments/${encodeURIComponent(reference)}/capture`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(config, token),
        "Idempotency-Key": vippsIdempotencyKey(
          "capture",
          reference,
          amount,
        ),
      },
      body: JSON.stringify({
        modificationAmount: { currency: "NOK", value: amount },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vipps capture-feil (${response.status}): ${errorBody}`);
  }
}
