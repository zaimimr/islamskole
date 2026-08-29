"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { createStudentEnrollment } from "@/app/[locale]/admin/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const inputClassName = "h-12";
const selectClassName =
  "h-12 w-full rounded-xl border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "islamskole-enrollment-draft-v1";

type EnrollmentDraft = {
  values: Record<string, string>;
  children: number[];
  guardians: number[];
  activeChild: number;
  step: number;
};

type ReviewSummary = {
  children: string[];
  guardians: { name: string; role: string; email: string }[];
  address: string;
};

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
    <p id={id} role="alert" className="text-sm font-semibold text-destructive">
      {message}
    </p>
  );
}

export function StudentSignupForm({
  fee,
  deposit,
  locale,
}: {
  fee: number;
  deposit: number;
  locale: string;
}) {
  const t = useTranslations("enrollForm");
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [step, setStep] = useState(0);
  const [children, setChildren] = useState<number[]>([0]);
  const [activeChild, setActiveChild] = useState(0);
  const [nextChildId, setNextChildId] = useState(1);
  const [guardians, setGuardians] = useState<number[]>([0]);
  const [nextGuardianId, setNextGuardianId] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [review, setReview] = useState<ReviewSummary>();
  const [draftValues, setDraftValues] = useState<Record<string, string> | null>(
    null,
  );
  const [draftReady, setDraftReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);

  const steps = [t("stepChildren"), t("stepGuardians"), t("stepReview")];
  const childField = (id: number, name: string) => `child_${id}_${name}`;
  const guardianField = (id: number, name: string) => `guardian_${id}_${name}`;
  const busy = pending || redirecting;
  const total = deposit * children.length;
  const restPerChild = Math.max(fee - deposit, 0);

  const persistDraft = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const values = Object.fromEntries(
      [...new FormData(form).entries()]
        .filter((entry): entry is [string, string] =>
          entry.every((value) => typeof value === "string"),
        )
        .filter(
          ([name]) =>
            !["locale", "child_indices", "guardian_indices"].includes(name),
        ),
    );
    const draft: EnrollmentDraft = {
      values,
      children,
      guardians,
      activeChild,
      step: Math.min(step, 1),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [activeChild, children, guardians, step]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(DRAFT_KEY);
        if (!stored) {
          setDraftReady(true);
          return;
        }
        const draft = JSON.parse(stored) as Partial<EnrollmentDraft>;
        const storedChildren = Array.isArray(draft.children)
          ? draft.children.filter(Number.isInteger).slice(0, 10)
          : [];
        const storedGuardians = Array.isArray(draft.guardians)
          ? draft.guardians.filter(Number.isInteger).slice(0, 6)
          : [];
        const restoredChildren = storedChildren.length ? storedChildren : [0];
        const restoredGuardians = storedGuardians.length
          ? storedGuardians
          : [0];
        setChildren(restoredChildren);
        setGuardians(restoredGuardians);
        setActiveChild(
          restoredChildren.includes(draft.activeChild ?? -1)
            ? (draft.activeChild ?? restoredChildren[0])
            : restoredChildren[0],
        );
        setNextChildId(Math.max(...restoredChildren) + 1);
        setNextGuardianId(Math.max(...restoredGuardians) + 1);
        setStep(Math.min(Math.max(draft.step ?? 0, 0), 1));
        setDraftValues(draft.values ?? {});
      } catch {
        localStorage.removeItem(DRAFT_KEY);
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!draftValues || !formRef.current) return;
    for (const [name, value] of Object.entries(draftValues)) {
      const field = formRef.current.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ) {
        if (field instanceof HTMLInputElement && field.type === "checkbox") {
          field.checked = true;
        } else {
          field.value = value;
        }
      }
    }
    const finishRestore = window.setTimeout(() => {
      dirtyRef.current = Object.keys(draftValues).length > 0;
      setDraftReady(true);
      setDraftValues(null);
    }, 0);
    return () => window.clearTimeout(finishRestore);
  }, [children, draftValues, guardians]);

  useEffect(() => {
    if (draftReady) persistDraft();
  }, [draftReady, persistDraft]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [busy]);

  function clearFieldError(name: string) {
    setFieldErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function describedBy(name: string) {
    return fieldErrors[name] ? `${name}-error` : undefined;
  }

  function invalid(name: string) {
    return fieldErrors[name] ? true : undefined;
  }

  function addChild() {
    const id = nextChildId;
    setChildren((current) => [...current, id]);
    setActiveChild(id);
    setNextChildId((current) => current + 1);
  }

  function removeChild(id: number) {
    if (children.length === 1) return;
    const next = children.filter((childId) => childId !== id);
    setChildren(next);
    if (activeChild === id) setActiveChild(next[0]);
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith(`child_${id}_`),
        ),
      ),
    );
  }

  function addGuardian() {
    const id = nextGuardianId;
    setGuardians((current) => [...current, id]);
    setNextGuardianId((current) => current + 1);
  }

  function removeGuardian(id: number) {
    if (id === 0) return;
    setGuardians((current) =>
      current.filter((guardianId) => guardianId !== id),
    );
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith(`guardian_${id}_`),
        ),
      ),
    );
  }

  function read(formData: FormData, name: string) {
    return ((formData.get(name) as string | null) ?? "").trim();
  }

  function validateChildren(formData: FormData) {
    const errors: Record<string, string> = {};
    for (const id of children) {
      for (const name of [
        "child_first_name",
        "child_last_name",
        "birth_date",
        "gender",
      ]) {
        const field = childField(id, name);
        if (!read(formData, field)) errors[field] = t("errorRequired");
      }
      const emailField = childField(id, "email");
      const email = read(formData, emailField);
      if (email && !isValidEmail(email)) errors[emailField] = t("errorEmail");
      const phoneField = childField(id, "phone");
      const phone = read(formData, phoneField);
      if (phone && !isValidPhone(phone)) errors[phoneField] = t("errorPhone");
    }
    return errors;
  }

  function validateGuardians(formData: FormData) {
    const errors: Record<string, string> = {};
    for (const id of guardians) {
      for (const name of [
        "first_name",
        "last_name",
        "email",
        "phone",
        "role",
      ]) {
        const field = guardianField(id, name);
        const value = read(formData, field);
        if (!value) errors[field] = t("errorRequired");
        if (name === "email" && value && !isValidEmail(value))
          errors[field] = t("errorEmail");
        if (name === "phone" && value && !isValidPhone(value))
          errors[field] = t("errorPhone");
      }
    }
    for (const name of ["address", "postal_code", "city"]) {
      if (!read(formData, name)) errors[name] = t("errorRequired");
    }
    return errors;
  }

  function validateTerms(formData: FormData): Record<string, string> {
    if (formData.get("terms_accepted")) return {};
    return { terms_accepted: t("errorTerms") };
  }

  function focusFirstError(errors: Record<string, string>) {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    const childMatch = /^child_(\d+)_/.exec(firstKey);
    if (childMatch) {
      setActiveChild(Number(childMatch[1]));
      setStep(0);
    } else if (
      firstKey.startsWith("guardian_") ||
      ["address", "postal_code", "city"].includes(firstKey)
    ) {
      setStep(1);
    } else {
      setStep(2);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = formRef.current?.querySelector<HTMLElement>(
          `[name="${firstKey}"]`,
        );
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.focus({ preventScroll: true });
      });
    });
  }

  function createReview(formData: FormData): ReviewSummary {
    return {
      children: children.map((id) =>
        [
          read(formData, childField(id, "child_first_name")),
          read(formData, childField(id, "child_last_name")),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      guardians: guardians.map((id) => ({
        name: [
          read(formData, guardianField(id, "first_name")),
          read(formData, guardianField(id, "last_name")),
        ]
          .filter(Boolean)
          .join(" "),
        role: read(formData, guardianField(id, "role")),
        email: read(formData, guardianField(id, "email")),
      })),
      address: [
        read(formData, "address"),
        read(formData, "postal_code"),
        read(formData, "city"),
      ]
        .filter(Boolean)
        .join(", "),
    };
  }

  function goForward() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    const errors =
      step === 0 ? validateChildren(formData) : validateGuardians(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(t("stepSummary"));
      focusFirstError(errors);
      return;
    }
    setFieldErrors({});
    setFormError(undefined);
    if (step === 1) setReview(createReview(formData));
    setStep((current) => Math.min(2, current + 1));
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goBack() {
    setFormError(undefined);
    setStep((current) => Math.max(0, current - 1));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const errors = {
      ...validateChildren(formData),
      ...validateGuardians(formData),
      ...validateTerms(formData),
    };
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
        localStorage.removeItem(DRAFT_KEY);
        dirtyRef.current = false;
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

  function renderChild(id: number, index: number) {
    const field = (name: string) => childField(id, name);
    return (
      <fieldset
        key={id}
        hidden={activeChild !== id}
        className="grid gap-6 rounded-2xl bg-muted/25 p-5 sm:p-6"
      >
        <legend className="sr-only">{t("childLabel", { n: index + 1 })}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("child_first_name")} required>
              {t("fieldFirstName")}
            </Label>
            <Input
              id={field("child_first_name")}
              name={field("child_first_name")}
              className={inputClassName}
              placeholder={t("placeholderFirstName")}
              autoComplete="off"
              aria-invalid={invalid(field("child_first_name"))}
              aria-describedby={describedBy(field("child_first_name"))}
              onInput={() => clearFieldError(field("child_first_name"))}
            />
            <FieldError
              id={`${field("child_first_name")}-error`}
              message={fieldErrors[field("child_first_name")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("child_last_name")} required>
              {t("fieldLastName")}
            </Label>
            <Input
              id={field("child_last_name")}
              name={field("child_last_name")}
              className={inputClassName}
              placeholder={t("placeholderLastName")}
              autoComplete="off"
              aria-invalid={invalid(field("child_last_name"))}
              aria-describedby={describedBy(field("child_last_name"))}
              onInput={() => clearFieldError(field("child_last_name"))}
            />
            <FieldError
              id={`${field("child_last_name")}-error`}
              message={fieldErrors[field("child_last_name")]}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("birth_date")} required>
              {t("fieldChildBirthDate")}
            </Label>
            <Input
              id={field("birth_date")}
              name={field("birth_date")}
              type="date"
              className={inputClassName}
              aria-invalid={invalid(field("birth_date"))}
              aria-describedby={describedBy(field("birth_date"))}
              onInput={() => clearFieldError(field("birth_date"))}
            />
            <FieldError
              id={`${field("birth_date")}-error`}
              message={fieldErrors[field("birth_date")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("gender")} required>
              {t("fieldGender")}
            </Label>
            <select
              id={field("gender")}
              name={field("gender")}
              defaultValue=""
              className={selectClassName}
              aria-invalid={invalid(field("gender"))}
              aria-describedby={describedBy(field("gender"))}
              onChange={() => clearFieldError(field("gender"))}
            >
              <option value="">{t("genderPlaceholder")}</option>
              {(["gutt", "jente"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`gender.${value}`)}
                </option>
              ))}
            </select>
            <FieldError
              id={`${field("gender")}-error`}
              message={fieldErrors[field("gender")]}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("email")}>{t("fieldEmail")}</Label>
            <Input
              id={field("email")}
              name={field("email")}
              type="email"
              inputMode="email"
              spellCheck={false}
              className={inputClassName}
              placeholder={t("placeholderEmail")}
              aria-invalid={invalid(field("email"))}
              aria-describedby={describedBy(field("email"))}
              onInput={() => clearFieldError(field("email"))}
            />
            <FieldError
              id={`${field("email")}-error`}
              message={fieldErrors[field("email")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("phone")}>{t("fieldPhone")}</Label>
            <Input
              id={field("phone")}
              name={field("phone")}
              type="tel"
              inputMode="tel"
              className={inputClassName}
              placeholder={t("placeholderPhone")}
              aria-invalid={invalid(field("phone"))}
              aria-describedby={describedBy(field("phone"))}
              onInput={() => clearFieldError(field("phone"))}
            />
            <FieldError
              id={`${field("phone")}-error`}
              message={fieldErrors[field("phone")]}
            />
          </div>
        </div>
        <details className="rounded-2xl border border-foreground/10 bg-card">
          <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            {t("optionalLearningDetails")}
          </summary>
          <div className="grid gap-5 border-t border-foreground/10 p-4">
            <div className="grid gap-2">
              <Label htmlFor={field("desired_class")}>
                {t("fieldDesiredClass")}
              </Label>
              <Input
                id={field("desired_class")}
                name={field("desired_class")}
                className={inputClassName}
                placeholder={t("placeholderDesiredClass")}
              />
            </div>
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
                  <Label htmlFor={field(name)}>{t(label)}</Label>
                  <select
                    id={field(name)}
                    name={field(name)}
                    defaultValue=""
                    className={selectClassName}
                  >
                    <option value="">{t("levelPlaceholder")}</option>
                    {(["nybegynner", "litt", "middels", "god"] as const).map(
                      (value) => (
                        <option key={value} value={value}>
                          {t(`levels.${value}`)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={field("message")}>{t("fieldMessage")}</Label>
              <Textarea
                id={field("message")}
                name={field("message")}
                rows={3}
                placeholder={t("placeholderMessage")}
              />
            </div>
          </div>
        </details>
      </fieldset>
    );
  }

  function renderGuardian(id: number, index: number) {
    const field = (name: string) => guardianField(id, name);
    return (
      <fieldset
        key={id}
        className="grid gap-5 rounded-2xl bg-muted/25 p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <legend className="font-heading text-lg font-bold">
            {index === 0
              ? t("primaryGuardian")
              : t("guardianLabel", { n: index + 1 })}
          </legend>
          {id !== 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeGuardian(id)}
              className="min-h-11 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("removeGuardian")}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("first_name")} required>
              {t("fieldFirstName")}
            </Label>
            <Input
              id={field("first_name")}
              name={field("first_name")}
              className={inputClassName}
              autoComplete={id === 0 ? "given-name" : "off"}
              placeholder={t("placeholderFirstName")}
              aria-invalid={invalid(field("first_name"))}
              aria-describedby={describedBy(field("first_name"))}
              onInput={() => clearFieldError(field("first_name"))}
            />
            <FieldError
              id={`${field("first_name")}-error`}
              message={fieldErrors[field("first_name")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("last_name")} required>
              {t("fieldLastName")}
            </Label>
            <Input
              id={field("last_name")}
              name={field("last_name")}
              className={inputClassName}
              autoComplete={id === 0 ? "family-name" : "off"}
              placeholder={t("placeholderLastName")}
              aria-invalid={invalid(field("last_name"))}
              aria-describedby={describedBy(field("last_name"))}
              onInput={() => clearFieldError(field("last_name"))}
            />
            <FieldError
              id={`${field("last_name")}-error`}
              message={fieldErrors[field("last_name")]}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("email")} required>
              {t("fieldParentEmail")}
            </Label>
            <Input
              id={field("email")}
              name={field("email")}
              type="email"
              inputMode="email"
              spellCheck={false}
              className={inputClassName}
              autoComplete={id === 0 ? "email" : "off"}
              placeholder={t("placeholderParentEmail")}
              aria-invalid={invalid(field("email"))}
              aria-describedby={describedBy(field("email"))}
              onInput={() => clearFieldError(field("email"))}
            />
            <FieldError
              id={`${field("email")}-error`}
              message={fieldErrors[field("email")]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("phone")} required>
              {t("fieldParentPhone")}
            </Label>
            <Input
              id={field("phone")}
              name={field("phone")}
              type="tel"
              inputMode="tel"
              className={inputClassName}
              autoComplete={id === 0 ? "tel" : "off"}
              placeholder={t("placeholderParentPhone")}
              aria-invalid={invalid(field("phone"))}
              aria-describedby={describedBy(field("phone"))}
              onInput={() => clearFieldError(field("phone"))}
            />
            <FieldError
              id={`${field("phone")}-error`}
              message={fieldErrors[field("phone")]}
            />
          </div>
        </div>
        <div className="grid max-w-sm gap-2">
          <Label htmlFor={field("role")} required>
            {t("guardianRole")}
          </Label>
          <select
            id={field("role")}
            name={field("role")}
            defaultValue={id === 0 ? "foresatt" : ""}
            className={selectClassName}
            aria-invalid={invalid(field("role"))}
            aria-describedby={describedBy(field("role"))}
            onChange={() => clearFieldError(field("role"))}
          >
            <option value="">{t("guardianRolePlaceholder")}</option>
            {(
              [
                "foresatt",
                "mor",
                "far",
                "steforelder",
                "verge",
                "annet",
              ] as const
            ).map((value) => (
              <option key={value} value={value}>
                {t(`guardianRoles.${value}`)}
              </option>
            ))}
          </select>
          <FieldError
            id={`${field("role")}-error`}
            message={fieldErrors[field("role")]}
          />
        </div>
        {id === 0 ? (
          <div className="flex items-start gap-3 rounded-xl bg-primary/8 px-4 py-3 text-sm text-foreground">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-brand-green-dark"
              aria-hidden="true"
            />
            <p>{t("primaryGuardianHint")}</p>
            <input type="hidden" name={field("is_primary")} value="true" />
          </div>
        ) : null}
      </fieldset>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChangeCapture={() => {
        dirtyRef.current = true;
        window.setTimeout(persistDraft, 0);
      }}
      noValidate
      className="grid gap-8"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="child_indices" value={children.join(",")} />
      <input
        type="hidden"
        name="guardian_indices"
        value={guardians.join(",")}
      />
      <nav aria-label={t("progressLabel")}>
        <ol className="grid grid-cols-3 gap-2">
          {steps.map((label, index) => {
            const complete = index < step;
            const current = index === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    if (index < step) setStep(index);
                  }}
                  disabled={index > step}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold transition-colors sm:px-3 sm:text-sm",
                    current && "bg-primary/12 text-brand-green-dark",
                    complete && "text-brand-green-dark hover:bg-primary/8",
                    !current && !complete && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                      current &&
                        "border-primary bg-primary text-primary-foreground",
                      complete && "border-primary bg-primary/12",
                      !current && !complete && "border-border bg-card",
                    )}
                  >
                    {complete ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      {formError ? (
        <div
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
        >
          {formError}
        </div>
      ) : null}

      <section
        hidden={step !== 0}
        className="grid gap-6"
        aria-labelledby="children-step-title"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/12 text-brand-green-dark">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3
              id="children-step-title"
              className="font-heading text-2xl font-bold"
            >
              {t("childrenStepTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("childrenStepHint")}
            </p>
          </div>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={t("childrenTabsLabel")}
        >
          {children.map((id, index) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeChild === id}
              onClick={() => setActiveChild(id)}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                activeChild === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-primary/10",
              )}
            >
              {t("childLabel", { n: index + 1 })}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addChild}
            className="min-h-11 rounded-full"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("addChild")}
          </Button>
        </div>
        {children.map((id, index) => renderChild(id, index))}
        {children.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => removeChild(activeChild)}
            className="min-h-11 justify-self-start text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("removeCurrentChild")}
          </Button>
        ) : null}
      </section>

      <section
        hidden={step !== 1}
        className="grid gap-7"
        aria-labelledby="guardians-step-title"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/12 text-brand-green-dark">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3
              id="guardians-step-title"
              className="font-heading text-2xl font-bold"
            >
              {t("guardiansStepTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("guardiansStepHint")}
            </p>
          </div>
        </div>
        <fieldset className="grid gap-5 rounded-2xl border border-foreground/10 p-5 sm:p-6">
          <legend className="px-1 font-heading text-lg font-bold">
            {t("sectionAddress")}
          </legend>
          <p className="text-sm text-muted-foreground">{t("addressHint")}</p>
          <div className="grid gap-2">
            <Label htmlFor="address" required>
              {t("fieldAddress")}
            </Label>
            <Input
              id="address"
              name="address"
              className={inputClassName}
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
              <Label htmlFor="postal_code" required>
                {t("fieldPostalCode")}
              </Label>
              <Input
                id="postal_code"
                name="postal_code"
                className={inputClassName}
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
              <Label htmlFor="city" required>
                {t("fieldCity")}
              </Label>
              <Input
                id="city"
                name="city"
                className={inputClassName}
                autoComplete="address-level2"
                placeholder={t("placeholderCity")}
                aria-invalid={invalid("city")}
                aria-describedby={describedBy("city")}
                onInput={() => clearFieldError("city")}
              />
              <FieldError id="city-error" message={fieldErrors.city} />
            </div>
          </div>
        </fieldset>
        <div className="grid gap-5">
          {guardians.map((id, index) => renderGuardian(id, index))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addGuardian}
          className="min-h-11 justify-self-start"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("addGuardian")}
        </Button>
      </section>

      <section
        hidden={step !== 2}
        className="grid gap-7"
        aria-labelledby="review-step-title"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/12 text-brand-green-dark">
            <CreditCard className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3
              id="review-step-title"
              className="font-heading text-2xl font-bold"
            >
              {t("reviewStepTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("reviewStepHint")}
            </p>
          </div>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-foreground/10 bg-border">
          <div className="flex items-start justify-between gap-4 bg-card p-5">
            <div>
              <p className="text-sm font-bold">{t("reviewChildren")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {review?.children.filter(Boolean).join(", ")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(0)}
              className="min-h-11"
            >
              {t("edit")}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 bg-card p-5">
            <div>
              <p className="text-sm font-bold">{t("reviewGuardians")}</p>
              <div className="mt-1 grid gap-1 text-sm text-muted-foreground">
                {review?.guardians.map((guardian) => (
                  <p key={`${guardian.name}-${guardian.email}`}>
                    {guardian.name} · {t(`guardianRoles.${guardian.role}`)} ·{" "}
                    {guardian.email}
                  </p>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="min-h-11"
            >
              {t("edit")}
            </Button>
          </div>
          <div className="bg-card p-5">
            <p className="text-sm font-bold">{t("sectionAddress")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {review?.address}
            </p>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl bg-primary/8 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-brand-green-dark"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-foreground">
                {t("paymentImmediateTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("paymentImmediateBody")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-5 border-t border-foreground/10 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("feeNote", { fee: formatNok(fee), deposit: formatNok(deposit) })}
              </p>
              {restPerChild > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("planNote", { rest: formatNok(restPerChild) })}
                </p>
              ) : null}
              <p className="text-sm font-semibold">{t("totalLabel")}</p>
            </div>
            <p className="font-heading text-3xl font-bold tabular-nums text-brand-green-dark">
              {formatNok(total)} kr
            </p>
          </div>
          <label className="flex min-h-12 items-start gap-3 rounded-xl bg-card p-4 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="terms_accepted"
              aria-invalid={invalid("terms_accepted")}
              aria-describedby={describedBy("terms_accepted")}
              onChange={() => clearFieldError("terms_accepted")}
              className="mt-0.5 size-5 shrink-0 rounded border-input accent-brand-green-dark aria-invalid:outline aria-invalid:outline-destructive"
            />
            <span>
              {t("termsLead")}{" "}
              <Link
                href="/salgsbetingelser"
                target="_blank"
                className="font-semibold text-brand-green-dark underline underline-offset-4"
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
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-foreground/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={busy}
            className="min-h-12"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button type="button" onClick={goForward} className="min-h-12 px-6">
            {t("next")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" disabled={busy} className="min-h-12 px-7">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {redirecting ? t("redirecting") : t("submit")}
          </Button>
        )}
      </div>
    </form>
  );
}
