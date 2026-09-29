"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MapPin, Pencil } from "lucide-react";
import { updateFamilyAddress } from "@/lib/portal/family-actions";
import type { PortalFamily } from "@/lib/portal/family-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote, Field, formText, useErrorText } from "@/components/portal/family/family-ui";

export function AddressSection({ family }: { family: PortalFamily }) {
  const t = useTranslations("portal.family");
  const errorText = useErrorText();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idPrefix = `address-${family.id}`;
  const hasAddress = Boolean(family.address || family.postal_code || family.city);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateFamilyAddress(family.id, {
        address: formText(form, "address"),
        postalCode: formText(form, "postal_code"),
        city: formText(form, "city"),
      });
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      setEditing(false);
      toast.success(t("address.saved"));
    });
  }

  return (
    <section aria-labelledby={`${idPrefix}-title`} className="grid gap-3 px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${idPrefix}-title`} className="flex items-center gap-2 font-heading text-lg font-semibold">
          <MapPin aria-hidden="true" className="size-5 text-brand-green-dark" />
          {t("address.title")}
        </h3>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label={t("editLabel", { what: t("address.title").toLowerCase() })}
          >
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field id={`${idPrefix}-street`} label={t("address.street")}>
            <Input
              id={`${idPrefix}-street`}
              name="address"
              required
              maxLength={200}
              autoComplete="street-address"
              defaultValue={family.address ?? ""}
            />
          </Field>
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <Field id={`${idPrefix}-postal`} label={t("address.postalCode")}>
              <Input
                id={`${idPrefix}-postal`}
                name="postal_code"
                required
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                autoComplete="postal-code"
                defaultValue={family.postal_code ?? ""}
              />
            </Field>
            <Field id={`${idPrefix}-city`} label={t("address.city")}>
              <Input
                id={`${idPrefix}-city`}
                name="city"
                required
                maxLength={100}
                autoComplete="address-level2"
                defaultValue={family.city ?? ""}
              />
            </Field>
          </div>
          {error ? <ErrorNote message={error} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {t("save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={pending}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : hasAddress ? (
        <p className="text-pretty">
          {family.address}
          <span className="block">{[family.postal_code, family.city].filter(Boolean).join(" ")}</span>
        </p>
      ) : (
        <p className="text-muted-foreground">{t("address.missing")}</p>
      )}
    </section>
  );
}
