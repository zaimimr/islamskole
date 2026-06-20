"use client";

import { useRef, useState, useTransition } from "react";
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
  "h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

const fieldOrder = [
  "child_first_name",
  "child_last_name",
  "birth_date",
  "gender",
  "address",
  "postal_code",
  "city",
  "email",
  "phone",
  "mother_last_name",
  "mother_first_name",
  "mother_phone",
  "mother_email",
  "father_last_name",
  "father_first_name",
  "father_phone",
  "father_email",
  "parents",
  "desired_class",
  "level_quran",
  "level_arabic",
  "level_islam",
  "message",
  "terms_accepted",
] as const;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

export function StudentSignupForm() {
  const t = useTranslations("enrollForm");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function handleReset() {
    setFormKey((key) => key + 1);
    setFieldErrors({});
    setFormError(undefined);
    setDone(false);
  }

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function focusFirstError(errors: Record<string, string>) {
    const form = formRef.current;
    if (!form) return;
    const firstKey = fieldOrder.find((key) => key in errors);
    if (!firstKey) return;
    const anchor =
      firstKey === "parents"
        ? form.querySelector<HTMLElement>("[data-parents-anchor]")
        : form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    anchor.focus({ preventScroll: true });
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createStudentApplication(formData);
      if (result.ok) {
        toast.success(t("toastSuccess"));
        setFieldErrors({});
        setFormError(undefined);
        setDone(true);
        return;
      }
      const errors = result.fieldErrors ?? {};
      setFieldErrors(errors);
      setFormError(result.error);
      if (result.error) {
        toast.error(result.error);
      }
      focusFirstError(errors);
    });
  }

  function describedBy(name: string) {
    return fieldErrors[name] ? `${name}-error` : undefined;
  }

  function invalid(name: string) {
    return fieldErrors[name] ? true : undefined;
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
    <form
      key={formKey}
      ref={formRef}
      action={handleSubmit}
      noValidate
      className="grid gap-8"
    >
      {formError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {formError}
        </div>
      ) : null}

      <fieldset className="grid gap-5">
        <legend className="mb-1 font-heading text-lg font-bold">
          {t("sectionStudent")}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="child_first_name" required>
              {t("fieldFirstName")}
            </Label>
            <Input
              id="child_first_name"
              name="child_first_name"
              aria-invalid={invalid("child_first_name")}
              aria-describedby={describedBy("child_first_name")}
              onInput={() => clearFieldError("child_first_name")}
            />
            <FieldError
              id="child_first_name-error"
              message={fieldErrors.child_first_name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="child_last_name" required>
              {t("fieldLastName")}
            </Label>
            <Input
              id="child_last_name"
              name="child_last_name"
              aria-invalid={invalid("child_last_name")}
              aria-describedby={describedBy("child_last_name")}
              onInput={() => clearFieldError("child_last_name")}
            />
            <FieldError
              id="child_last_name-error"
              message={fieldErrors.child_last_name}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="birth_date" required>
              {t("fieldChildBirthDate")}
            </Label>
            <Input
              id="birth_date"
              name="birth_date"
              type="date"
              aria-invalid={invalid("birth_date")}
              aria-describedby={describedBy("birth_date")}
              onInput={() => clearFieldError("birth_date")}
            />
            <FieldError id="birth_date-error" message={fieldErrors.birth_date} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gender" required>
              {t("fieldGender")}
            </Label>
            <select
              id="gender"
              name="gender"
              defaultValue=""
              aria-invalid={invalid("gender")}
              aria-describedby={describedBy("gender")}
              onChange={() => clearFieldError("gender")}
              className={selectClassName}
            >
              <option value="">{t("genderPlaceholder")}</option>
              {(["gutt", "jente"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`gender.${v}`)}
                </option>
              ))}
            </select>
            <FieldError id="gender-error" message={fieldErrors.gender} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="address">{t("fieldAddress")}</Label>
          <Input
            id="address"
            name="address"
            autoComplete="street-address"
            placeholder={t("placeholderAddress")}
            aria-invalid={invalid("address")}
            aria-describedby={describedBy("address")}
            onInput={() => clearFieldError("address")}
          />
          <FieldError id="address-error" message={fieldErrors.address} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="postal_code">{t("fieldPostalCode")}</Label>
            <Input
              id="postal_code"
              name="postal_code"
              autoComplete="postal-code"
              placeholder={t("placeholderPostalCode")}
              aria-invalid={invalid("postal_code")}
              aria-describedby={describedBy("postal_code")}
              onInput={() => clearFieldError("postal_code")}
            />
            <FieldError
              id="postal_code-error"
              message={fieldErrors.postal_code}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="city">{t("fieldCity")}</Label>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              placeholder={t("placeholderCity")}
              aria-invalid={invalid("city")}
              aria-describedby={describedBy("city")}
              onInput={() => clearFieldError("city")}
            />
            <FieldError id="city-error" message={fieldErrors.city} />
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
              autoComplete="email"
              placeholder={t("placeholderEmail")}
              aria-invalid={invalid("email")}
              aria-describedby={describedBy("email")}
              onInput={() => clearFieldError("email")}
            />
            <FieldError id="email-error" message={fieldErrors.email} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">{t("fieldPhone")}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder={t("placeholderPhone")}
              aria-invalid={invalid("phone")}
              aria-describedby={describedBy("phone")}
              onInput={() => clearFieldError("phone")}
            />
            <FieldError id="phone-error" message={fieldErrors.phone} />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-5" data-parents-anchor tabIndex={-1}>
        <legend className="mb-1 font-heading text-lg font-bold">
          {t("sectionMother")}
        </legend>
        {fieldErrors.parents ? (
          <p
            id="parents-error"
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {fieldErrors.parents}
          </p>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mother_last_name">{t("fieldLastName")}</Label>
            <Input
              id="mother_last_name"
              name="mother_last_name"
              aria-invalid={invalid("mother_last_name")}
              aria-describedby={describedBy("mother_last_name")}
              onInput={() => {
                clearFieldError("mother_last_name");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="mother_last_name-error"
              message={fieldErrors.mother_last_name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mother_first_name">{t("fieldFirstName")}</Label>
            <Input
              id="mother_first_name"
              name="mother_first_name"
              aria-invalid={invalid("mother_first_name")}
              aria-describedby={describedBy("mother_first_name")}
              onInput={() => {
                clearFieldError("mother_first_name");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="mother_first_name-error"
              message={fieldErrors.mother_first_name}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mother_phone">{t("fieldParentPhone")}</Label>
            <Input
              id="mother_phone"
              name="mother_phone"
              type="tel"
              aria-invalid={invalid("mother_phone")}
              aria-describedby={describedBy("mother_phone")}
              onInput={() => {
                clearFieldError("mother_phone");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="mother_phone-error"
              message={fieldErrors.mother_phone}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mother_email">{t("fieldParentEmail")}</Label>
            <Input
              id="mother_email"
              name="mother_email"
              type="email"
              aria-invalid={invalid("mother_email")}
              aria-describedby={describedBy("mother_email")}
              onInput={() => {
                clearFieldError("mother_email");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="mother_email-error"
              message={fieldErrors.mother_email}
            />
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
            <Input
              id="father_last_name"
              name="father_last_name"
              aria-invalid={invalid("father_last_name")}
              aria-describedby={describedBy("father_last_name")}
              onInput={() => {
                clearFieldError("father_last_name");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="father_last_name-error"
              message={fieldErrors.father_last_name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="father_first_name">{t("fieldFirstName")}</Label>
            <Input
              id="father_first_name"
              name="father_first_name"
              aria-invalid={invalid("father_first_name")}
              aria-describedby={describedBy("father_first_name")}
              onInput={() => {
                clearFieldError("father_first_name");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="father_first_name-error"
              message={fieldErrors.father_first_name}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="father_phone">{t("fieldParentPhone")}</Label>
            <Input
              id="father_phone"
              name="father_phone"
              type="tel"
              aria-invalid={invalid("father_phone")}
              aria-describedby={describedBy("father_phone")}
              onInput={() => {
                clearFieldError("father_phone");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="father_phone-error"
              message={fieldErrors.father_phone}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="father_email">{t("fieldParentEmail")}</Label>
            <Input
              id="father_email"
              name="father_email"
              type="email"
              aria-invalid={invalid("father_email")}
              aria-describedby={describedBy("father_email")}
              onInput={() => {
                clearFieldError("father_email");
                clearFieldError("parents");
              }}
            />
            <FieldError
              id="father_email-error"
              message={fieldErrors.father_email}
            />
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
          aria-invalid={invalid("desired_class")}
          aria-describedby={describedBy("desired_class")}
          onInput={() => clearFieldError("desired_class")}
        />
        <FieldError
          id="desired_class-error"
          message={fieldErrors.desired_class}
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
                aria-invalid={invalid(name)}
                aria-describedby={describedBy(name)}
                onChange={() => clearFieldError(name)}
                className={selectClassName}
              >
                <option value="">{t("levelPlaceholder")}</option>
                {(["nybegynner", "litt", "middels", "god"] as const).map(
                  (v) => (
                    <option key={v} value={v}>
                      {t(`levels.${v}`)}
                    </option>
                  ),
                )}
              </select>
              <FieldError id={`${name}-error`} message={fieldErrors[name]} />
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
          aria-invalid={invalid("message")}
          aria-describedby={describedBy("message")}
          onInput={() => clearFieldError("message")}
        />
        <FieldError id="message-error" message={fieldErrors.message} />
      </div>

      <div className="grid gap-3 rounded-2xl bg-primary/6 p-4">
        <p className="text-sm font-semibold text-foreground">{t("feeNote")}</p>
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="terms_accepted"
            aria-invalid={invalid("terms_accepted")}
            aria-describedby={describedBy("terms_accepted")}
            onChange={() => clearFieldError("terms_accepted")}
            className="mt-1 size-4 shrink-0 rounded border-input accent-brand-green-dark aria-invalid:outline aria-invalid:outline-destructive"
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
        <FieldError
          id="terms_accepted-error"
          message={fieldErrors.terms_accepted}
        />
      </div>

      <Button type="submit" disabled={pending} className="h-12 w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Sender ..." : t("submit")}
      </Button>
    </form>
  );
}
