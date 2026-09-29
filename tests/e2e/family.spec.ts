import { expect, test } from "playwright/test";
import { db, loginAs, readOutbox, seedFamily, toast, zzEmail } from "./fixtures";

async function one<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error || data == null) throw new Error(error?.message ?? "no row");
  return data as T;
}

test.describe("parent edits family on Min familie", () => {
  test("edit phone and address, add allergy and pickup person", async ({ context, page }) => {
    const family = await seedFamily();
    const [guardian] = family.guardians;
    const [child] = family.students;
    await loginAs(context, guardian.email);
    await page.goto("/min-side/familie");
    await expect(page.getByRole("heading", { level: 1, name: "Min familie" })).toBeVisible();

    await page.getByRole("button", { name: "Endre adresse" }).click();
    await page.getByLabel("Gateadresse").fill("ZZTEST vei 12");
    await page.getByLabel("Postnummer").fill("1350");
    await page.getByLabel("Poststed").fill("Lommedalen");
    await page.getByRole("button", { name: "Lagre", exact: true }).first().click();
    await expect(toast(page, "Adressen er lagret.")).toBeVisible();
    await expect
      .poll(async () => (await one<{ address: string; postal_code: string; city: string }>(db().from("families").select("address, postal_code, city").eq("id", family.id).single())))
      .toEqual({ address: "ZZTEST vei 12", postal_code: "1350", city: "Lommedalen" });

    await page.getByRole("button", { name: `Endre ${guardian.name}` }).click();
    const guardianDialog = page.getByRole("dialog");
    await guardianDialog.getByLabel(/^Telefon/).fill("40404040");
    await guardianDialog.getByRole("button", { name: "Lagre" }).click();
    await expect(toast(page, "Opplysningene er lagret.")).toBeVisible();
    await expect
      .poll(async () => (await one<{ phone: string }>(db().from("guardians").select("phone").eq("id", guardian.id).single())).phone)
      .toBe("40404040");

    const childCard = page.getByTestId("family-child").filter({ hasText: child.name });
    await childCard.getByLabel("Allergier").fill("ZZTEST nøtter");
    await childCard.getByLabel("Ja").check();
    await childCard.getByRole("button", { name: "Lagre" }).click();
    await expect(toast(page, `Opplysningene om ${child.firstName} er lagret.`)).toBeVisible();
    await expect
      .poll(async () => await one<{ allergies: string; photo_consent: boolean }>(db().from("students").select("allergies, photo_consent").eq("id", child.id).single()))
      .toEqual({ allergies: "ZZTEST nøtter", photo_consent: true });

    await page.getByRole("button", { name: "Legg til person" }).click();
    const pickupDialog = page.getByRole("dialog");
    await pickupDialog.getByLabel("Navn").fill("ZZTEST Bestemor");
    await pickupDialog.getByLabel(/^Telefon/).fill("41414141");
    await pickupDialog.getByLabel(/^Hvem er det/).fill("bestemor");
    await pickupDialog.getByRole("button", { name: "Legg til person" }).click();
    await expect(page.getByTestId("family-pickup").filter({ hasText: "ZZTEST Bestemor" })).toBeVisible();
    await expect
      .poll(async () => await one<{ name: string }[]>(db().from("family_pickup_persons").select("name").eq("family_id", family.id)))
      .toEqual([{ name: "ZZTEST Bestemor" }]);
  });

  test("email change is confirmed through a link sent to the new address", async ({ context, page }) => {
    const family = await seedFamily();
    const [guardian] = family.guardians;
    const newEmail = zzEmail("ny-epost");
    await loginAs(context, guardian.email);
    await page.goto("/min-side/familie");

    const since = Date.now();
    await page.getByRole("button", { name: `Endre e-post for ${guardian.name}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Ny e-postadresse").fill(newEmail);
    await dialog.getByRole("button", { name: "Send lenke" }).click();
    await expect(page.getByText(`Venter på bekreftelse: ${newEmail}`)).toBeVisible();
    expect((await one<{ email: string }>(db().from("guardians").select("email").eq("id", guardian.id).single())).email).toBe(guardian.email);

    await expect
      .poll(() => readOutbox(newEmail, since)?.links.find((link) => link.includes("/min-side/bekreft-epost")) ?? null, {
        timeout: 20_000,
      })
      .not.toBeNull();
    const link = readOutbox(newEmail, since)!.links.find((value) => value.includes("/min-side/bekreft-epost"))!;
    const url = new URL(link);

    await page.goto(`${url.pathname}${url.search}`);
    await expect(page.getByText(newEmail)).toBeVisible();
    await page.getByRole("button", { name: "Bekreft e-post" }).click();
    await expect(page.getByRole("heading", { name: "E-posten er endret" })).toBeVisible();
    await expect(page).toHaveURL(/ferdig=1/);
    await expect
      .poll(async () => (await one<{ email: string }>(db().from("guardians").select("email").eq("id", guardian.id).single())).email)
      .toBe(newEmail.toLowerCase());

    await page.goto(`${url.pathname}${url.search}`);
    await expect(page.getByRole("heading", { name: "Lenken virker ikke" })).toBeVisible();
  });
});
