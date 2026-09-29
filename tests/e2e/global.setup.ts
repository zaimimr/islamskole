import { expect, test as setup } from "playwright/test";
import { BASE_URL, assertLocal, localSupabase } from "./env";
import { cleanupTestData, clearOutbox, db, loginAs, readState, restoreActiveYear, writeState, zzEmail } from "./fixtures";

setup("local stack only, clean data, one active school year", async ({ browser }) => {
  assertLocal(localSupabase());

  const previous = readState();
  if (previous) await restoreActiveYear();
  cleanupTestData();
  clearOutbox();

  const { data: active, error } = await db().from("school_years").select("id, label").eq("is_active", true);
  if (error) throw error;
  if ((active?.length ?? 0) > 1) throw new Error("More than one active school year in the local database");

  let originalActiveYearId = active?.[0]?.id ?? null;
  let createdActiveYearId: string | null = null;
  if (!originalActiveYearId) {
    const year = new Date().getUTCFullYear();
    const { data, error: insertError } = await db()
      .from("school_years")
      .insert({
        label: `ZZTEST aktivt ${year}/${year + 1}`,
        starts_on: `${year}-08-01`,
        ends_on: `${year + 1}-06-30`,
        is_active: true,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    createdActiveYearId = (data as { id: string }).id;
    originalActiveYearId = null;
  }
  writeState({ originalActiveYearId, createdActiveYearId });

  const context = await browser.newContext({ baseURL: BASE_URL });
  await loginAs(context, zzEmail("probe"));
  const response = await context.request.get("/min-side/logg-inn", { maxRedirects: 0 });
  await context.close();
  expect(
    [303, 307, 308].includes(response.status()),
    "The dev server on port 3100 did not accept a local Supabase session. It is probably wired to another Supabase project. Stop it and rerun.",
  ).toBe(true);
});
