import { readFileSync, existsSync } from "node:fs";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    void 0;
  }
}

function resolveEnvFile() {
  const explicit = process.env.VIPPS_ENV_FILE;
  const path = explicit ?? ".env.vipps.prod";
  if (!existsSync(path)) {
    console.error(`\nEnv file not found: ${path}`);
    console.error(
      explicit
        ? "Check VIPPS_ENV_FILE, or drop the variable to use .env.vipps.prod."
        : "Create .env.vipps.prod with the PRODUCTION Vipps credentials:\n" +
          "  VIPPS_BASE_URL=https://api.vipps.no\n" +
          "  VIPPS_CLIENT_ID=...\n" +
          "  VIPPS_CLIENT_SECRET=...\n" +
          "  VIPPS_SUBSCRIPTION_KEY=...\n" +
          "  VIPPS_MSN=...\n" +
          "\nTo deliberately target the test merchant instead:\n" +
          "  VIPPS_ENV_FILE=.env.local node " + process.argv[1],
    );
    process.exit(1);
  }
  return path;
}

const envFile = resolveEnvFile();
loadEnv(envFile);

const EVENTS = [
  "epayments.payment.created.v1",
  "epayments.payment.authorized.v1",
  "epayments.payment.captured.v1",
  "epayments.payment.cancelled.v1",
  "epayments.payment.refunded.v1",
  "epayments.payment.aborted.v1",
  "epayments.payment.expired.v1",
];

const baseUrl = (process.env.VIPPS_BASE_URL ?? "https://api.vipps.no").replace(
  /\/$/,
  "",
);
const clientId = process.env.VIPPS_CLIENT_ID;
const clientSecret = process.env.VIPPS_CLIENT_SECRET;
const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY;
const msn = process.env.VIPPS_MSN;

if (!clientId || !clientSecret || !subscriptionKey || !msn) {
  console.error(
    "Missing VIPPS_CLIENT_ID / VIPPS_CLIENT_SECRET / VIPPS_SUBSCRIPTION_KEY / VIPPS_MSN",
  );
  process.exit(1);
}

const isTest = baseUrl.includes("apitest");
console.log(
  `Environment: ${isTest ? "TEST" : "PRODUCTION"}  ${baseUrl}  MSN ${msn}  (from ${envFile})`,
);
if (isTest) {
  console.log(
    "NOTE: this is the TEST merchant. Production payment references will return 404 here.",
  );
}
console.log("");

const tokenResponse = await fetch(`${baseUrl}/accesstoken/get`, {
  method: "POST",
  headers: {
    client_id: clientId,
    client_secret: clientSecret,
    "Ocp-Apim-Subscription-Key": subscriptionKey,
  },
});
if (!tokenResponse.ok) {
  console.error(
    "token failed",
    tokenResponse.status,
    await tokenResponse.text(),
  );
  process.exit(1);
}
const token = (await tokenResponse.json()).access_token;

const headers = {
  Authorization: `Bearer ${token}`,
  "Ocp-Apim-Subscription-Key": subscriptionKey,
  "Merchant-Serial-Number": msn,
  "Vipps-System-Name": "islamskole",
  "Content-Type": "application/json",
};

const [command, argument] = process.argv.slice(2);

async function list() {
  const response = await fetch(`${baseUrl}/webhooks/v1/webhooks`, { headers });
  const text = await response.text();
  console.log(response.status, text);
  return response.ok ? (JSON.parse(text).webhooks ?? []) : [];
}

if (!command || command === "list") {
  await list();
  process.exit(0);
}

if (command === "register") {
  const url = argument ?? "https://www.islamskole.no/api/vipps/webhook";
  const existing = await list();
  if (existing.some((hook) => hook.url === url)) {
    console.log(
      `\nA webhook for ${url} already exists. Delete it first to get a new secret.`,
    );
    process.exit(0);
  }

  const response = await fetch(`${baseUrl}/webhooks/v1/webhooks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, events: EVENTS }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("register failed", response.status, text);
    process.exit(1);
  }

  const created = JSON.parse(text);
  console.log("\nRegistered webhook", created.id, "for", url);
  console.log("\nSet this in Vercel (production) and redeploy:\n");
  console.log(`  VIPPS_WEBHOOK_SECRET=${created.secret}`);
  console.log("\nThe secret is shown once. Store it now.");
  process.exit(0);
}

if (command === "delete") {
  if (!argument) {
    console.error("Usage: node scripts/vipps-webhook.mjs delete <webhook-id>");
    process.exit(1);
  }
  const response = await fetch(
    `${baseUrl}/webhooks/v1/webhooks/${encodeURIComponent(argument)}`,
    { method: "DELETE", headers },
  );
  console.log(response.status, await response.text());
  process.exit(0);
}

console.error(
  `Unknown command: ${command}. Use list, register [url], or delete <id>.`,
);
process.exit(1);
