import { expect, test, type Page } from "playwright/test";
import {
  db,
  ensureAuthUser,
  findAuthUser,
  hasRowAction,
  loginAs,
  profileRole,
  rowAction,
  rowWith,
  seedAdmin,
  seedFamily,
  confirmIfAsked,
  waitForLoginLink,
  zzEmail,
} from "./fixtures";

async function openGrantForm(page: Page) {
  const trigger = page.getByRole("button", { name: "Gi administratortilgang" });
  if (await trigger.count()) await trigger.first().click();
  return page.getByRole("dialog").or(page.getByRole("form", { name: "Gi administratortilgang" })).first();
}

async function grantAdmin(page: Page, name: string, email: string) {
  const form = await openGrantForm(page);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await form.getByLabel("Navn").fill(name);
  await form.getByLabel("E-post").fill(email);
  await form.getByRole("button", { name: "Gi tilgang" }).click();
}

test.describe("/admin/brukere", () => {
  test.beforeEach(async ({ context }) => {
    const me = await seedAdmin();
    await loginAs(context, me.email);
    test.info().annotations.push({ type: "me", description: me.email });
  });

  test("AUTH-12 heading is Brukere og tilganger", async ({ page }) => {
    await page.goto("/admin/brukere");
    await expect(page.getByRole("heading", { level: 1, name: "Brukere og tilganger" })).toBeVisible();
  });

  test("AUTH-15 Gi administratortilgang for a brand new email sends a login link", async ({ page }) => {
    const email = zzEmail("ny-admin");
    await page.goto("/admin/brukere");
    const since = Date.now();
    await grantAdmin(page, "ZZTEST Ny Admin", email);
    await expect.poll(() => profileRole(email)).toBe("admin");
    await waitForLoginLink(email, since);
    await page.reload();
    const row = rowWith(page, email);
    await expect(row).toBeVisible();
    await expect(row.getByText("Admin", { exact: true })).toBeVisible();
  });

  test("AUTH-12 Gi administratortilgang for an email that already has a portal login", async ({ page }) => {
    const family = await seedFamily();
    const guardian = family.guardians[0];
    const before = await ensureAuthUser(guardian.email);
    await page.goto("/admin/brukere");
    await grantAdmin(page, guardian.name, guardian.email.toUpperCase());
    await expect.poll(() => profileRole(guardian.email)).toBe("admin");
    const after = await findAuthUser(guardian.email);
    expect(after?.id).toBe(before.id);
    await page.reload();
    const row = rowWith(page, guardian.email);
    await expect(row.getByText("Admin", { exact: true })).toBeVisible();
    await expect(row.getByText("Foresatt", { exact: true })).toBeVisible();
  });

  test("AUTH-14 Fjern administratortilgang is not offered for yourself", async ({ page }) => {
    const me = test.info().annotations.find((note) => note.type === "me")!.description!;
    const other = await seedAdmin();
    await page.goto("/admin/brukere");
    const mine = rowWith(page, me);
    await expect(mine).toBeVisible();
    expect(await hasRowAction(page, mine, "Fjern administratortilgang")).toBe(false);
    const theirs = rowWith(page, other.email);
    expect(await hasRowAction(page, theirs, "Fjern administratortilgang")).toBe(true);
  });

  test("AUTH-13 Fjern administratortilgang demotes without deleting the login", async ({ page }) => {
    const other = await seedAdmin();
    await page.goto("/admin/brukere");
    await rowAction(page, rowWith(page, other.email), "Fjern administratortilgang");
    await confirmIfAsked(page, /^(Fjern administratortilgang|Fjern tilgang|Fjern)/);
    await expect.poll(() => profileRole(other.email)).toBe("member");
    expect(await findAuthUser(other.email)).not.toBeNull();
  });

  test("AUTH-12 Gjør til lærer makes an admin a teacher", async ({ page }) => {
    const other = await seedAdmin();
    await page.goto("/admin/brukere");
    await rowAction(page, rowWith(page, other.email), "Gjør til lærer");
    await confirmIfAsked(page, /^(Gjør til lærer|Bekreft)/);
    await expect
      .poll(async () => {
        const { data } = await db().from("guardians").select("is_teacher").ilike("email", other.email);
        return (data as { is_teacher: boolean }[] | null)?.map((row) => row.is_teacher) ?? [];
      })
      .toEqual([true]);
    await page.goto("/admin/laerere");
    await expect(rowWith(page, other.email)).toBeVisible();
    await page.goto("/admin/brukere");
    await expect(rowWith(page, other.email).getByText("Lærer", { exact: true })).toBeVisible();
  });
});
