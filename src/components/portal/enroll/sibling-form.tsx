"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { enrollSibling, type SiblingField } from "@/lib/portal/enrollment-actions";
import type { PortalErrorCode } from "@/lib/portal/types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type SiblingFamily = {
  id: string;
  name: string;
  parents: string;
  address: string;
  postalCode: string;
  city: string;
};

const pillClass =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 ring-foreground/10 transition-colors has-checked:bg-primary/10 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

export function SiblingForm({ families, deposit }: { families: SiblingFamily[]; deposit: string }) {
  const t = useTranslations("portal.enroll.sibling");
  const tErrors = useTranslations("portal.errors");
  const locale = useLocale();
  const [familyId, setFamilyId] = useState(families[0]?.id ?? "");
  const [fields, setFields] = useState<SiblingField[]>([]);
  const [error, setError] = useState<PortalErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const family = families.find((row) => row.id === familyId) ?? families[0];

  function invalid(field: SiblingField) {
    return fields.includes(field) || undefined;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("family_id", familyId);
    formData.set("locale", locale);
    setError(null);
    setFields([]);
    startTransition(async () => {
      const result = await enrollSibling(formData);
      if (result.ok) {
        window.location.assign(result.redirectUrl);
        return;
      }
      setFields(result.fields ?? []);
      setError(result.error ?? "unknown");
    });
  }

  if (!family) return null;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      {families.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">{t("family")}</legend>
          {families.map((row) => (
            <label key={row.id} className={pillClass}>
              <input
                type="radio"
                name="family_choice"
                checked={familyId === row.id}
                onChange={() => setFamilyId(row.id)}
                className="size-4 accent-[var(--brand-green-dark)]"
              />
              {row.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      <p className="rounded-xl bg-muted/60 p-4 text-sm text-pretty">{t("parents", { names: family.parents })}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sibling-first-name">{t("firstName")}</Label>
          <Input id="sibling-first-name" name="first_name" autoComplete="off" className="h-12" aria-invalid={invalid("firstName")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sibling-last-name">{t("lastName")}</Label>
          <Input id="sibling-last-name" name="last_name" autoComplete="off" className="h-12" aria-invalid={invalid("lastName")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sibling-birth-date">{t("birthDate")}</Label>
          <Input
            id="sibling-birth-date"
            name="birth_date"
            type="date"
            className="h-12"
            aria-invalid={invalid("birthDate")}
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("gender")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["jente", "gutt"] as const).map((value) => (
              <label key={value} className={cn(pillClass, invalid("gender") && "ring-destructive")}>
                <input type="radio" name="gender" value={value} className="size-4 accent-[var(--brand-green-dark)]" />
                {t(`genders.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset key={family.id} className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">{t("address")}</legend>
        <Input
          name="address"
          aria-label={t("street")}
          defaultValue={family.address}
          autoComplete="street-address"
          className="h-12"
          aria-invalid={invalid("address")}
        />
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Input
            name="postal_code"
            aria-label={t("postalCode")}
            defaultValue={family.postalCode}
            inputMode="numeric"
            autoComplete="postal-code"
            className="h-12"
            aria-invalid={invalid("postalCode")}
          />
          <Input
            name="city"
            aria-label={t("city")}
            defaultValue={family.city}
            autoComplete="address-level2"
            className="h-12"
            aria-invalid={invalid("city")}
          />
        </div>
      </fieldset>

      <details className="rounded-2xl ring-1 ring-foreground/10">
        <summary className="min-h-12 cursor-pointer rounded-2xl px-4 py-3 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("optional")}
        </summary>
        <div className="grid gap-4 border-t border-foreground/10 p-4">
          <div className="grid gap-2">
            <Label htmlFor="sibling-desired-class">{t("desiredClass")}</Label>
            <Input id="sibling-desired-class" name="desired_class" className="h-12" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sibling-message">{t("message")}</Label>
            <Textarea id="sibling-message" name="message" rows={3} maxLength={2000} />
          </div>
        </div>
      </details>

      <p className="text-pretty">{t("deposit", { amount: deposit })}</p>

      <label className="flex min-h-12 items-start gap-3 rounded-xl bg-muted/60 p-4 text-sm">
        <input
          type="checkbox"
          name="terms_accepted"
          aria-invalid={invalid("terms")}
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand-green-dark)] aria-invalid:outline aria-invalid:outline-destructive"
        />
        <span>
          {t("termsLead")}{" "}
          <Link href="/salgsbetingelser" target="_blank" className="font-semibold text-brand-green-dark underline underline-offset-4">
            {t("termsLink")}
          </Link>
          {t("termsTail")}
        </span>
      </label>

      {error ? (
        <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error === "closed" ? t("closed") : fields.includes("terms") && fields.length === 1 ? t("termsError") : tErrors(error)}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
