import { expect, test } from "playwright/test";
import { activeYear, db, enroll, loginAs, seedClass, seedFamily, seedPayment } from "./fixtures";

test.describe("Min økonomi for parents", () => {
  test("NEW-PARENT-ECONOMY parent sees what is left and paying creates one payment for the siblings", async ({ page, context }) => {
    const year = await activeYear();
    const schoolClass = await seedClass();
    const family = await seedFamily({ students: [{}, {}] });
    const [first, second] = family.students;
    await enroll(first.id, schoolClass.id, year.id, 300000);
    await enroll(second.id, schoolClass.id, year.id, 200000);
    await seedPayment(first.id, year.id, 100000);

    const other = await seedFamily();
    await enroll(other.students[0].id, schoolClass.id, year.id, 300000);

    await loginAs(context, family.guardians[0].email);
    await page.goto("/min-side/okonomi");

    await expect(page.getByRole("heading", { level: 1, name: "Min økonomi" })).toBeVisible();
    await expect(page.getByText(/Gjenstår 4\s000 kr for skoleåret/)).toBeVisible();
    await expect(page.getByText(first.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(second.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(other.students[0].name)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send kvittering på e-post" })).toBeVisible();

    const payRequest = page.waitForRequest(/\/api\/vipps\/pay\/[0-9a-f-]{36}\?locale=no/);
    await page.getByRole("button", { name: "Betal alt som gjenstår med Vipps" }).click();
    const request = await payRequest;
    const paymentId = new URL(request.url()).pathname.split("/").pop() as string;

    const { data: payment } = await db()
      .from("payments")
      .select("amount, method, school_year_id, student_id, payment_targets(student_id, amount)")
      .eq("id", paymentId)
      .single();
    expect(payment?.method).toBe("vipps");
    expect(payment?.school_year_id).toBe(year.id);
    expect(payment?.student_id).toBeNull();
    expect(payment?.amount).toBe(400000);
    const targets = new Map(
      (payment?.payment_targets as { student_id: string; amount: number }[]).map((row) => [row.student_id, row.amount]),
    );
    expect(targets.get(first.id)).toBe(200000);
    expect(targets.get(second.id)).toBe(200000);

    await page.goto("/min-side/okonomi");
    const again = page.waitForRequest(/\/api\/vipps\/pay\//);
    await page.getByRole("button", { name: "Betal alt som gjenstår med Vipps" }).click();
    expect((await again).url()).toContain(paymentId);
  });

  test("NEW-PARENT-ECONOMY-EMPTY parent without fees sees a friendly empty state", async ({ page, context }) => {
    const family = await seedFamily();
    await loginAs(context, family.guardians[0].email);
    await page.goto("/min-side/okonomi");
    await expect(page.getByRole("heading", { name: "Ingen skolepenger å vise" })).toBeVisible();
  });

  test("NEW-PARENT-ECONOMY-LOGIN logged out visitor is sent to login", async ({ page }) => {
    await page.goto("/min-side/okonomi");
    await expect(page).toHaveURL(/\/min-side\/logg-inn/);
  });
});
