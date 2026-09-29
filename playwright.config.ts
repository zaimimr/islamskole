import { defineConfig } from "playwright/test";
import { BASE_URL, OUTBOX_DIR, PORT, assertLocal, localSupabase } from "./tests/e2e/env";

function requestedProjects() {
  const names: string[] = [];
  process.argv.forEach((arg, index) => {
    if (arg.startsWith("--project=")) names.push(arg.slice("--project=".length));
    else if (arg === "--project" && process.argv[index + 1]) names.push(process.argv[index + 1]);
  });
  return names;
}

const projects = requestedProjects();
const wantsE2E = projects.length === 0 || projects.some((name) => name.startsWith("e2e"));
const supabase = wantsE2E ? localSupabase() : null;
if (supabase) assertLocal(supabase);

export default defineConfig({
  testDir: "tests",
  workers: wantsE2E ? 1 : undefined,
  projects: [
    {
      name: "unit",
      testMatch: "*.spec.ts",
      testIgnore: "e2e/**",
    },
    {
      name: "e2e-setup",
      testDir: "tests/e2e",
      testMatch: "global.setup.ts",
      teardown: "e2e-teardown",
      use: { baseURL: BASE_URL },
    },
    {
      name: "e2e-teardown",
      testDir: "tests/e2e",
      testMatch: "global.teardown.ts",
    },
    {
      name: "e2e",
      testDir: "tests/e2e",
      testMatch: "**/*.spec.ts",
      dependencies: ["e2e-setup"],
      timeout: 90_000,
      expect: { timeout: 15_000 },
      use: {
        baseURL: BASE_URL,
        locale: "nb-NO",
        timezoneId: "Europe/Oslo",
        trace: "retain-on-failure",
        actionTimeout: 10_000,
        navigationTimeout: 45_000,
      },
    },
  ],
  webServer:
    wantsE2E && supabase
      ? {
          command: `npx next dev -p ${PORT}`,
          url: `${BASE_URL}/min-side/logg-inn`,
          reuseExistingServer: true,
          timeout: 240_000,
          stdout: "ignore",
          stderr: "pipe",
          env: {
            NEXT_PUBLIC_SUPABASE_URL: supabase.url,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
            SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
            SUPABASE_DB_PASSWORD: "",
            NEXT_PUBLIC_SITE_URL: BASE_URL,
            EMAIL_OUTBOX_DIR: OUTBOX_DIR,
            EMAILS_ENABLED: "true",
            RESEND_API_KEY: "re_test_dummy",
            RESEND_FROM: "Islamskole Test <test@zztest.local>",
            VIPPS_BASE_URL: "",
            VIPPS_CLIENT_ID: "",
            VIPPS_CLIENT_SECRET: "",
            VIPPS_SUBSCRIPTION_KEY: "",
            VIPPS_WEBHOOK_SECRET: "",
            VIPPS_MSN: "",
            VIPPS_SYSTEM_NAME: "",
            VIPPS_AUTO_CAPTURE: "",
            CRON_SECRET: "test",
            GEMINI_API_KEY: "",
          },
        }
      : undefined,
});
