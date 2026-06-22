"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createStudentEnrollment } from "@/app/[locale]/admin/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const inputClassName = "h-11";

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return EMAIL_RE.test(value);
}

function isValidPhone(value: string) {
  return /^\+?\d{8,15}$/.test(value.replace(/[\s-]/g, ""));
}

function formatNok(amount: number) {
  return amount.toLocaleString("nb-NO");
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

export function StudentSignupForm({ fee }: { fee: number }) {
  const t = useTranslations("enrollForm");
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [children, setChildren] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);
  const [singleParent, setSingleParent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const childField = (id: number, name: string) => `child_${id}_${name}`;

  function addChild() {
    setChildren((prev) => [...prev, nextId]);
    setNextId((id) => id + 1);
  }

  function removeChild(id: number) {
    setChildren((prev) => (prev.length > 1 ? prev.filter((x) => x !== id) : prev));
    setFieldErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(`child_${id}_`)) next[key] = value;
      }
      return next;
    });
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
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    const anchor =
      firstKey === "parents"
        ? form.querySelector<HTMLElement>("[data-parents-anchor]")
        : form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    anchor.focus({ preventScroll: true });
  }

  function validate(formData: FormData): Record<string, string> {
    const value = (name: string) =>
      ((formData.get(name) as string | null) ?? "").trim();
    const errors: Record<string, string> = {};

    for (const id of children) {
      for (const name of [
        "child_first_name",
        "child_last_name",
        "birth_date",
        "gender",
      ]) {
        if (!value(childField(id, name))) {
          errors[childField(id, name)] = t("errorRequired");
        }
      }
      const email = value(childField(id, "email"));
      if (email && !isValidEmail(email)) {
        errors[childField(id, "email")] = t("errorEmail");
      }
      const phone = value(childField(id, "phone"));
      if (phone && !isValidPhone(phone)) {
        errors[childField(id, "phone")] = t("errorPhone");
      }
    }

    const single = Boolean(value("single_parent"));
    const parentComplete = (parent: string) => {
      const first = value(`${parent}_first_name`);
      const last = value(`${parent}_last_name`);
      const email = value(`${parent}_email`);
      const phone = value(`${parent}_phone`);
      return (
        first && last && isValidEmail(email) && isValidPhone(phone)
      );
    };

    if (single) {
      if (!parentComplete("mother") && !parentComplete("father")) {
        errors.parents = t("errorParents");
      }
      for (const parent of ["mother", "father"]) {
        const parentEmail = value(`${parent}_email`);
        if (parentEmail && !isValidEmail(parentEmail)) {
          errors[`${parent}_email`] = t("errorEmail");
        }
        const parentPhone = value(`${parent}_phone`);
        if (parentPhone && !isValidPhone(parentPhone)) {
          errors[`${parent}_phone`] = t("errorPhone");
        }
      }
    } else {
      for (const parent of ["mother", "father"]) {
        if (!value(`${parent}_first_name`)) {
          errors[`${parent}_first_name`] = t("errorRequired");
        }
        if (!value(`${parent}_last_name`)) {
          errors[`${parent}_last_name`] = t("errorRequired");
        }
        const parentEmail = value(`${parent}_email`);
        if (!parentEmail) errors[`${parent}_email`] = t("errorRequired");
        else if (!isValidEmail(parentEmail)) {
          errors[`${parent}_email`] = t("errorEmail");
        }
        const parentPhone = value(`${parent}_phone`);
        if (!parentPhone) errors[`${parent}_phone`] = t("errorRequired");
        else if (!isValidPhone(parentPhone)) {
          errors[`${parent}_phone`] = t("errorPhone");
        }
      }
    }

    if (!formData.get("terms_accepted")) {
      errors.terms_accepted = t("errorTerms");
    }

    return errors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(t("formSummary"));
      focusFirstError(errors);
      return;
    }

    setFieldErrors({});
    setFormError(undefined);

    startTransition(async () => {
      const result = await createStudentEnrollment(formData);
      if (result.ok) {
        setRedirecting(true);
        window.location.href = result.redirectUrl;
        return;
      }
      const serverErrors = result.fieldErrors ?? {};
      setFieldErrors(serverErrors);
      setFormError(result.error ?? t("formSummary"));
      if (result.error) toast.error(result.error);
      focusFirstError(serverErrors);
    });
  }

  function describedBy(name: string) {
    return fieldErrors[name] ? `${name}-error` : undefined;
  }

  function invalid(name: string) {
    return fieldErrors[name] ? true : undefined;
  }

  const total = fee * children.length;
  const busy = pending || redirecting;

  function renderChild(id: number, index: number) {
    const f = (name: string) => childField(id, name);
    return (
      <fieldset
        key={id}
        className="grid gap-5 rounded-2xl border border-foreground/10 bg-muted/20 p-5"
      >
        <div className="flex items-center justify-between">
          <legend className="font-heading text-lg font-bold">
            {t("childLabel", { n: index + 1 })}
          </legend>
          {children.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeChild(id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("removeChild")}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={f("child_first_name")} required>
              {t("fieldFirstName")}
            </Label>
            <Input
              id={f("child_first_name")}
              name={f("child_first_name")}
              className={inputClassName}
              placeholder={t("placeholderFirstName")}
              autoComplete="given-name"
              aria-invalid={invalid(f("child_first_name"))}
              aria-describedby={describedBy(f("child_first_name"))}
              onInput={() => clearFieldError(f("child_first_name"))}
            />
            <FieldError
              id={`${f("child_first_name")}-error`}
              message={fieldErrors[f("child_first_name")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("child_last_name")} required>
              {t("fieldLastName")}
            </Label>
            <Input
              id={f("child_last_name")}
              name={f("child_last_name")}
              className={inputClassName}
              placeholder={t("placeholderLastName")}
              autoComplete="family-name"
              aria-invalid={invalid(f("child_last_name"))}
              aria-describedby={describedBy(f("child_last_name"))}
              onInput={() => clearFieldError(f("child_last_name"))}
            />
            <FieldError
              id={`${f("child_last_name")}-error`}
              message={fieldErrors[f("child_last_name")]}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={f("birth_date")} required>
              {t("fieldChildBirthDate")}
            </Label>
            <Input
              id={f("birth_date")}
              name={f("birth_date")}
              type="date"
              className={inputClassName}
              aria-invalid={invalid(f("birth_date"))}
              aria-describedby={describedBy(f("birth_date"))}
              onInput={() => clearFieldError(f("birth_date"))}
            />
            <FieldError
              id={`${f("birth_date")}-error`}
              message={fieldErrors[f("birth_date")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("gender")} required>
              {t("fieldGender")}
            </Label>
            <select
              id={f("gender")}
              name={f("gender")}
              defaultValue=""
              aria-invalid={invalid(f("gender"))}
              aria-describedby={describedBy(f("gender"))}
              onChange={() => clearFieldError(f("gender"))}
              className={selectClassName}
            >
              <option value="">{t("genderPlaceholder")}</option>
              {(["gutt", "jente"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`gender.${v}`)}
                </option>
              ))}
            </select>
            <FieldError
              id={`${f("gender")}-error`}
              message={fieldErrors[f("gender")]}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={f("address")}>{t("fieldAddress")}</Label>
          <Input
            id={f("address")}
            name={f("address")}
            className={inputClassName}
            autoComplete="street-address"
            placeholder={t("placeholderAddress")}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={f("postal_code")}>{t("fieldPostalCode")}</Label>
            <Input
              id={f("postal_code")}
              name={f("postal_code")}
              className={inputClassName}
              autoComplete="postal-code"
              placeholder={t("placeholderPostalCode")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("city")}>{t("fieldCity")}</Label>
            <Input
              id={f("city")}
              name={f("city")}
              className={inputClassName}
              autoComplete="address-level2"
              placeholder={t("placeholderCity")}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={f("email")}>{t("fieldEmail")}</Label>
            <Input
              id={f("email")}
              name={f("email")}
              type="email"
              inputMode="email"
              className={inputClassName}
              placeholder={t("placeholderEmail")}
              aria-invalid={invalid(f("email"))}
              aria-describedby={describedBy(f("email"))}
              onInput={() => clearFieldError(f("email"))}
            />
            <FieldError
              id={`${f("email")}-error`}
              message={fieldErrors[f("email")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("phone")}>{t("fieldPhone")}</Label>
            <Input
              id={f("phone")}
              name={f("phone")}
              type="tel"
              inputMode="tel"
              className={inputClassName}
              placeholder={t("placeholderPhone")}
              aria-invalid={invalid(f("phone"))}
              aria-describedby={describedBy(f("phone"))}
              onInput={() => clearFieldError(f("phone"))}
            />
            <FieldError
              id={`${f("phone")}-error`}
              message={fieldErrors[f("phone")]}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={f("desired_class")}>{t("fieldDesiredClass")}</Label>
          <Input
            id={f("desired_class")}
            name={f("desired_class")}
            className={inputClassName}
            placeholder={t("placeholderDesiredClass")}
          />
        </div>

        <div className="grid gap-3 rounded-2xl bg-background/60 p-4">
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
                <Label htmlFor={f(name)}>{t(label)}</Label>
                <select
                  id={f(name)}
                  name={f(name)}
                  defaultValue=""
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
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={f("message")}>{t("fieldMessage")}</Label>
          <Textarea
            id={f("message")}
            name={f("message")}
            rows={3}
            placeholder={t("placeholderMessage")}
          />
        </div>
      </fieldset>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-8">
      {formError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {formError}
        </div>
      ) : null}

      <input type="hidden" name="child_indices" value={children.join(",")} />

      <div className="grid gap-5">
        {children.map((id, index) => renderChild(id, index))}
        <Button
          type="button"
          variant="outline"
          onClick={addChild}
          className="justify-self-start"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("addChild")}
        </Button>
      </div>

      <label className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          name="single_parent"
          checked={singleParent}
          onChange={(event) => {
            setSingleParent(event.target.checked);
            setFieldErrors((prev) => {
              const next: Record<string, string> = {};
              for (const [key, value] of Object.entries(prev)) {
                if (
                  key !== "parents" &&
                  !key.startsWith("mother_") &&
                  !key.startsWith("father_")
                ) {
                  next[key] = value;
                }
              }
              return next;
            });
          }}
          className="size-4 shrink-0 rounded border-input accent-brand-green-dark"
        />
        {t("singleParentLabel")}
      </label>

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
            <Label htmlFor="mother_first_name" required={!singleParent}>
              {t("fieldFirstName")}
            </Label>
            <Input
              id="mother_first_name"
              name="mother_first_name"
              className={inputClassName}
              placeholder={t("placeholderFirstName")}
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
          <div className="grid gap-2">
            <Label htmlFor="mother_last_name" required={!singleParent}>
              {t("fieldLastName")}
            </Label>
            <Input
              id="mother_last_name"
              name="mother_last_name"
              className={inputClassName}
              placeholder={t("placeholderLastName")}
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
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mother_email" required={!singleParent}>
              {t("fieldParentEmail")}
            </Label>
            <Input
              id="mother_email"
              name="mother_email"
              type="email"
              inputMode="email"
              className={inputClassName}
              placeholder={t("placeholderParentEmail")}
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
          <div className="grid gap-2">
            <Label htmlFor="mother_phone" required={!singleParent}>
              {t("fieldParentPhone")}
            </Label>
            <Input
              id="mother_phone"
              name="mother_phone"
              type="tel"
              inputMode="tel"
              className={inputClassName}
              placeholder={t("placeholderParentPhone")}
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
        </div>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-1 font-heading text-lg font-bold">
          {t("sectionFather")}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="father_first_name" required={!singleParent}>
              {t("fieldFirstName")}
            </Label>
            <Input
              id="father_first_name"
              name="father_first_name"
              className={inputClassName}
              placeholder={t("placeholderFirstName")}
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
          <div className="grid gap-2">
            <Label htmlFor="father_last_name" required={!singleParent}>
              {t("fieldLastName")}
            </Label>
            <Input
              id="father_last_name"
              name="father_last_name"
              className={inputClassName}
              placeholder={t("placeholderLastName")}
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
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="father_email" required={!singleParent}>
              {t("fieldParentEmail")}
            </Label>
            <Input
              id="father_email"
              name="father_email"
              type="email"
              inputMode="email"
              className={inputClassName}
              placeholder={t("placeholderParentEmail")}
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
          <div className="grid gap-2">
            <Label htmlFor="father_phone" required={!singleParent}>
              {t("fieldParentPhone")}
            </Label>
            <Input
              id="father_phone"
              name="father_phone"
              type="tel"
              inputMode="tel"
              className={inputClassName}
              placeholder={t("placeholderParentPhone")}
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
        </div>
        <p className="text-sm text-muted-foreground">{t("parentsHint")}</p>
      </fieldset>

      <div className="grid gap-3 rounded-2xl bg-primary/6 p-4">
        <p className="text-sm font-semibold text-foreground">
          {t("feeNote", { fee: formatNok(fee) })}
        </p>
        <div className="flex items-center justify-between border-t border-foreground/10 pt-3">
          <span className="text-sm font-semibold text-foreground">
            {t("totalLabel")}
          </span>
          <span className="font-heading text-xl font-bold text-brand-green-dark">
            {formatNok(total)} kr
          </span>
        </div>
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
        <p className="text-sm text-muted-foreground">{t("payHint")}</p>
      </div>

      <Button type="submit" disabled={busy} className="h-12 w-full sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {redirecting ? t("redirecting") : t("submit")}
      </Button>
    </form>
  );
}
