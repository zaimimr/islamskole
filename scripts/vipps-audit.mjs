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

const baseUrl = (process.env.VIPPS_BASE_URL ?? "https://api.vipps.no").replace(/\/$/, "");
const clientId = process.env.VIPPS_CLIENT_ID;
const clientSecret = process.env.VIPPS_CLIENT_SECRET;
const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY;
const msn = process.env.VIPPS_MSN;

if (!clientId || !clientSecret || !subscriptionKey || !msn) {
  console.error("Missing VIPPS_CLIENT_ID / VIPPS_CLIENT_SECRET / VIPPS_SUBSCRIPTION_KEY / VIPPS_MSN");
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
  console.error("token failed", tokenResponse.status, await tokenResponse.text());
  process.exit(1);
}
const token = (await tokenResponse.json()).access_token;

const headers = {
  Authorization: `Bearer ${token}`,
  "Ocp-Apim-Subscription-Key": subscriptionKey,
  "Merchant-Serial-Number": msn,
  "Vipps-System-Name": "islamskole-audit",
  "Content-Type": "application/json",
};

const hooks = await fetch(`${baseUrl}/webhooks/v1/webhooks`, { headers });
console.log("=== registered webhooks ===");
console.log(hooks.status, await hooks.text());

const refs = process.argv.slice(2);
if (refs.length === 0) process.exit(0);

console.log("\n=== payment states ===");
for (const reference of refs) {
  const response = await fetch(`${baseUrl}/epayment/v1/payments/${encodeURIComponent(reference)}`, { headers });
  if (!response.ok) {
    console.log(`${reference}\tHTTP ${response.status}\t${(await response.text()).slice(0, 160)}`);
    continue;
  }
  const data = await response.json();
  const aggregate = data.aggregate ?? {};
  console.log(
    [
      reference,
      data.state,
      `auth=${(aggregate.authorizedAmount?.value ?? 0) / 100}`,
      `captured=${(aggregate.capturedAmount?.value ?? 0) / 100}`,
      `refunded=${(aggregate.refundedAmount?.value ?? 0) / 100}`,
    ].join("\t"),
  );
}
