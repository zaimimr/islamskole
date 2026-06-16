import "server-only";
import { randomUUID } from "node:crypto";

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

export type CreatePaymentInput = {
  reference: string;
  amount: number;
  description: string;
  returnUrl: string;
  phoneNumber?: string | null;
};

export type CreatePaymentResult = {
  reference: string;
  redirectUrl: string;
};

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
    paymentDescription: input.description,
  };

  if (normalizedPhone && normalizedPhone.length >= 10) {
    body.customer = { phoneNumber: normalizedPhone };
  }

  const response = await fetch(`${config.baseUrl}/epayment/v1/payments`, {
    method: "POST",
    headers: {
      ...baseHeaders(config, token),
      "Idempotency-Key": randomUUID(),
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

export type VippsPaymentState =
  | "CREATED"
  | "ABORTED"
  | "EXPIRED"
  | "AUTHORIZED"
  | "TERMINATED";

export type GetPaymentResult = {
  state: VippsPaymentState;
  authorizedAmount: number;
  capturedAmount: number;
  refundedAmount: number;
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
  };

  return {
    state: data.state,
    authorizedAmount: data.aggregate?.authorizedAmount?.value ?? 0,
    capturedAmount: data.aggregate?.capturedAmount?.value ?? 0,
    refundedAmount: data.aggregate?.refundedAmount?.value ?? 0,
  };
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
        "Idempotency-Key": randomUUID(),
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
        "Idempotency-Key": randomUUID(),
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
        "Idempotency-Key": `capture-${reference}`,
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
