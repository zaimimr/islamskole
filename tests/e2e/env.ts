import { execFileSync } from "node:child_process";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "../..");
export const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
export const OUTBOX_DIR = path.join(ROOT, "test-results", "outbox");
export const STATE_FILE = path.join(ROOT, "node_modules", ".cache", "islamskole-e2e-state.json");
export const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export type LocalSupabase = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
};

function readStatus(): Record<string, string> {
  try {
    const output = execFileSync("supabase", ["status", "-o", "env"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const entries: [string, string][] = [];
    for (const line of output.split("\n")) {
      const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
      if (match) entries.push([match[1], match[2]]);
    }
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function localSupabase(): LocalSupabase {
  if (process.env.E2E_SUPABASE_URL === undefined) {
    const status = readStatus();
    process.env.E2E_SUPABASE_URL = status.API_URL || "http://127.0.0.1:54321";
    process.env.E2E_SUPABASE_ANON_KEY = status.ANON_KEY ?? "";
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY ?? "";
    process.env.E2E_SUPABASE_DB_URL =
      status.DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  }
  return {
    url: process.env.E2E_SUPABASE_URL,
    anonKey: process.env.E2E_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
    dbUrl: process.env.E2E_SUPABASE_DB_URL ?? "",
  };
}

export function assertLocal(supabase: LocalSupabase) {
  const host = new URL(supabase.url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to run e2e tests against ${supabase.url}. Only the local Supabase stack is allowed.`);
  }
  const dbHost = new URL(supabase.dbUrl).hostname;
  if (!LOCAL_HOSTS.has(dbHost)) {
    throw new Error(`Refusing to run e2e tests against database host ${dbHost}.`);
  }
  if (!supabase.anonKey || !supabase.serviceRoleKey) {
    throw new Error("Local Supabase keys are missing. Start the stack with `supabase start`.");
  }
}
