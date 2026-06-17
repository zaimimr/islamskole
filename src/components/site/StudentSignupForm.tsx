"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, PartyPopper } from "lucide-react";
import { createStudentApplication } from "@/app/[locale]/admin/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function StudentSignupForm() {
  const t = useTranslations("enrollForm");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function handleReset() {
    setFormKey((key) => key + 1);
    setDone(false);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createStudentApplication(formData);
      if (result.ok) {
        toast.success(t("toastSuccess"));
        setDone(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-primary/8 px-6 py-12 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/15 text-brand-green-dark">
          <PartyPopper className="size-7" aria-hidden="true" />
        </span>
        <h3 className="font-heading text-2xl font-bold">{t("thanksTitle")}</h3>
        <p className="max-w-md text-base text-muted-foreground">
          {t("thanksBody")}
        </p>
        <Button variant="outline" onClick={handleReset}>
          {t("submitAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form key={formKey} action={handleSubmit} className="grid gap-8">
      <fieldset className="grid gap-5">
        <legend className="mb-1 font-heading text-lg font-bold">
          {t("sectionStudent")}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="child_first_name" required>
              {t("fieldFirstName")}
            </Label>
            <Input id="child_first_name" name="child_first_name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="child_last_name" required>
              {t("fieldLastName")}
            </Label>
            <Input id="child_last_name" name="child_last_name" required />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="birth_date">{t("fieldChildBirthDate")}</Label>
            <Input id="birth_date" name="birth_date" type="date" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gender">{t("fieldGender")}</Label>
            <select
              id="gender"
              name="gender"
              defaultValue=""
              className={selectClassName}
            >
              <option value="">{t("genderPlaceholder")}</option>
              {(["gutt", "jente"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`gender.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="address">{t("fieldAddress")}</Label>
          <Input
            id="address"
            name="address"
            autoComplete="street-address"
            placeholder={t("placeholderAddress")}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="postal_code">{t("fieldPostalCode")}</Label>
            <Input
              id="postal_code"
              name="postal_code"
              autoComplete="postal-code"
              placeholder={t("placeholderPostalCode")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="city">{t("fieldCity")}</Label>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              placeholder={t("placeholderCity")}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="email" required>
              {t("fieldEmail")}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("placeholderEmail")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">{t("fieldPhone")}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder={t("placeholderPhone")}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-1 font-heading text-lg font-bold">
          {t("sectionMother")}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mother_last_name">{t("fieldLastName")}</Label>
            <Input id="mother_last_name" name="mother_last_name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mother_first_name">{t("fieldFirstName")}</Label>
            <Input id="mother_first_name" name="mother_first_name" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mother_phone">{t("fieldParentPhone")}</Label>
            <Input id="mother_phone" name="mother_phone" type="tel" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mother_email">{t("fieldParentEmail")}</Label>
            <Input id="mother_email" name="mother_email" type="email" />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-1 font-heading text-lg font-bold">
          {t("sectionFather")}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="father_last_name">{t("fieldLastName")}</Label>
            <Input id="father_last_name" name="father_last_name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="father_first_name">{t("fieldFirstName")}</Label>
            <Input id="father_first_name" name="father_first_name" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="father_phone">{t("fieldParentPhone")}</Label>
            <Input id="father_phone" name="father_phone" type="tel" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="father_email">{t("fieldParentEmail")}</Label>
            <Input id="father_email" name="father_email" type="email" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("parentsHint")}</p>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="desired_class">{t("fieldDesiredClass")}</Label>
        <Input
          id="desired_class"
          name="desired_class"
          placeholder={t("placeholderDesiredClass")}
        />
      </div>

      <div className="grid gap-3 rounded-2xl bg-muted/40 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("levelsTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t("levelsHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["level_quran", "levelQuran"],
              ["level_arabic", "levelArabic"],
              ["level_islam", "levelIslam"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="grid gap-2">
              <Label htmlFor={name}>{t(label)}</Label>
              <select
                id={name}
                name={name}
                defaultValue=""
                className={selectClassName}
              >
                <option value="">{t("levelPlaceholder")}</option>
                {(["nybegynner", "litt", "middels", "god"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`levels.${v}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="message">{t("fieldMessage")}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder={t("placeholderMessage")}
        />
      </div>

      <div className="grid gap-3 rounded-2xl bg-primary/6 p-4">
        <p className="text-sm font-semibold text-foreground">{t("feeNote")}</p>
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="terms_accepted"
            required
            className="mt-1 size-4 shrink-0 rounded border-input accent-brand-green-dark"
          />
          <span>
            {t("termsLead")}{" "}
            <Link
              href="/salgsbetingelser"
              target="_blank"
              className="font-semibold text-brand-green-dark underline underline-offset-2"
            >
              {t("termsLink")}
            </Link>
            {t("termsTail")}
          </span>
        </label>
      </div>

      <Button type="submit" disabled={pending} className="h-12 w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
