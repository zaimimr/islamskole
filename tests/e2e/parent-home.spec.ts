import { expect, test } from "playwright/test";
import {
  activeYear,
  db,
  enroll,
  loginAs,
  schoolDaysOf,
  seedClass,
  seedFamily,
  seedNote,
  seedSchoolDays,
  uid,
} from "./fixtures";

function osloToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
}

async function seedParentWorld() {
  const year = await activeYear();
  const schoolClass = await seedClass();
  const family = await seedFamily({ guardians: [{}, {}] });
  const student = family.students[0];
  await enroll(student.id, schoolClass.id, year.id, 300000);
  const days = await seedSchoolDays(year, 3);
  const homework = `ZZTEST lekse ${uid()}`;
  await seedNote(schoolClass.id, days[0].id, homework);
  return { year, schoolClass, family, student, days, homework };
}

test.describe("Min side front page for parents", () => {
  let restoreYear: (() => Promise<void>) | null = null;
  test.afterEach(async () => {
    await restoreYear?.();
    restoreYear = null;
  });

  test("shows next school day, homework and shortcuts", async ({ page, context }) => {
    const world = await seedParentWorld();
    await loginAs(context, world.family.guardians[0].email);
    await page.goto("/min-side");

    const today = osloToday();
    const next = (await schoolDaysOf(world.year.id)).find((day) => day.date >= today) ?? null;
    const nextDay = page.getByRole("region", { name: "Neste skoledag" });
    await expect(nextDay).toBeVisible();
    if (next) {
      await expect(nextDay.getByRole("button", { name: "Meld fravær" })).toBeVisible();
    } else {
      await expect(nextDay).toContainText("ingen flere skoledager");
    }

    await expect(page.getByText(world.homework, { exact: true })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Min side" });
    await expect(nav.getByRole("link", { name: "Oversikt" })).toHaveAttribute("aria-current", "page");
    for (const [name, href] of [
      ["Min familie", "/min-side/familie"],
      ["Min økonomi", "/min-side/okonomi"],
      ["Påmelding", "/min-side/pamelding"],
    ]) {
      await expect(nav.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    const shortcuts = page.getByRole("navigation", { name: "Snarveier" });
    await expect(shortcuts.getByRole("link", { name: /Min familie/ })).toHaveAttribute("href", "/min-side/familie");
    await expect(shortcuts.getByRole("link", { name: /Min økonomi/ })).toHaveAttribute("href", "/min-side/okonomi");
    await expect(shortcuts.getByRole("link", { name: /Påmelding/ })).toHaveAttribute("href", "/min-side/pamelding");

    await expect(page.getByRole("link", { name: /Mangler helseinfo eller fotosamtykke/ })).toHaveAttribute(
      "href",
      "/min-side/familie",
    );
  });

  test("parent answers whether the child continues next year", async ({ page, context }) => {
    const world = await seedParentWorld();
    await loginAs(context, world.family.guardians[0].email);
    await page.goto("/min-side/pamelding");

    const group = page.getByRole("group", { name: `Fortsetter ${world.student.firstName} neste skoleår?` });
    await group.getByRole("button", { name: "Ja" }).click();
    await expect(group.getByRole("button", { name: "Ja" })).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await db().from("students").select("continues_next_year").eq("id", world.student.id).single()).data?.continues_next_year)
      .toBe(true);

    await group.getByRole("button", { name: "Nei" }).click();
    await expect(group.getByRole("button", { name: "Nei" })).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await db().from("students").select("continues_next_year").eq("id", world.student.id).single()).data?.continues_next_year)
      .toBe(false);
  });

  test("sibling signup creates an application in the existing family and a Vipps payment", async ({ page, context }) => {
    const world = await seedParentWorld();
    const { data: year } = await db()
      .from("school_years")
      .select("label, fee, enrollment_fee")
      .eq("id", world.year.id)
      .single();
    await db().from("school_years").update({ fee: 5000, enrollment_fee: 2000 }).eq("id", world.year.id);
    restoreYear = async () => {
      await db()
        .from("school_years")
        .update({ fee: year?.fee ?? null, enrollment_fee: year?.enrollment_fee ?? 0 })
        .eq("id", world.year.id);
    };
    await db()
      .from("families")
      .update({ address: "ZZTEST vei 1", postal_code: "1300", city: "Sandvika" })
      .eq("id", world.family.id);

    await loginAs(context, world.family.guardians[0].email);
    let payUrl: string | null = null;
    await page.route("**/api/vipps/pay/**", async (route) => {
      payUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "<p>vipps</p>" });
    });
    await page.goto("/min-side/pamelding");

    const firstName = `ZZTEST Søsken ${uid()}`;
    const startYear = Number(String(year?.label ?? "").match(/\d{4}/)?.[0] ?? new Date().getFullYear());
    const form = page.getByRole("region", { name: "Meld på søsken" });
    await form.getByLabel("Fornavn").fill(firstName);
    await form.getByLabel("Etternavn").fill("ZZTEST");
    await form.getByLabel("Fødselsdato").fill(`${startYear - 8}-05-01`);
    await form.getByLabel("Jente").check();
    await expect(form.getByLabel("Gateadresse")).toHaveValue("ZZTEST vei 1");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Meld på og betal med Vipps" }).click();

    await expect.poll(() => payUrl).toMatch(/\/api\/vipps\/pay\/[0-9a-f-]{36}\?locale=no$/);

    const { data: application } = await db()
      .from("student_applications")
      .select("family_id, payment_id, mother_first_name, father_first_name, child_address, status")
      .eq("child_first_name", firstName)
      .single();
    expect(application?.family_id).toBe(world.family.id);
    expect(application?.status).toBe("ny");
    expect(application?.child_address).toBe("ZZTEST vei 1");
    expect(application?.mother_first_name).toBe(world.family.guardians[0].firstName);
    expect(application?.father_first_name).toBe(world.family.guardians[1].firstName);
    expect(payUrl).toContain(application?.payment_id ?? "missing");

    const { data: payment } = await db()
      .from("payments")
      .select("status, method, amount, school_year_id")
      .eq("id", application?.payment_id ?? "")
      .single();
    expect(payment?.status).toBe("opprettet");
    expect(payment?.method).toBe("vipps");
    expect(payment?.school_year_id).toBe(world.year.id);
    expect(payment?.amount).toBe(200000);

    const { count } = await db().from("families").select("id", { count: "exact", head: true }).eq("id", world.family.id);
    expect(count).toBe(1);
  });
});
