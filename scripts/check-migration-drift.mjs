import { readdirSync } from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "shryfgcxydlhgyhcbryq";
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.log("SUPABASE_ACCESS_TOKEN is not set, skipping migration drift check.");
  process.exit(0);
}

const local = new Map(
  readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((file) => /^\d{14}_.+\.sql$/.test(file))
    .map((file) => {
      const [, version, name] = file.match(/^(\d{14})_(.+)\.sql$/);
      return [version, name];
    }),
);

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!response.ok) {
  console.error(`Could not list remote migrations: ${response.status} ${await response.text()}`);
  process.exit(1);
}

const remote = new Map((await response.json()).map((row) => [row.version, row.name ?? ""]));

const onlyRemote = [...remote].filter(([version]) => !local.has(version));
const onlyLocal = [...local].filter(([version]) => !remote.has(version));
const renamed = [...local].filter(
  ([version, name]) => remote.has(version) && remote.get(version) && remote.get(version) !== name,
);

for (const [version, name] of onlyRemote) {
  console.log(`missing locally: ${version}_${name}`);
}
for (const [version, name] of onlyLocal) {
  console.log(`not applied remotely: ${version}_${name}.sql`);
}
for (const [version, name] of renamed) {
  console.log(`name differs: ${version} local "${name}" remote "${remote.get(version)}"`);
}

if (onlyRemote.length || renamed.length) {
  console.error("\nMigration history differs from production.");
  process.exit(1);
}

console.log(
  onlyLocal.length
    ? `\nLocal is ahead of production by ${onlyLocal.length} migration(s).`
    : "\nLocal migrations match production.",
);
