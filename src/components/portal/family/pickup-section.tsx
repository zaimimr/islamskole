"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HandHeart, Loader2, Plus, Trash2 } from "lucide-react";
import { addPickupPerson, removePickupPerson } from "@/lib/portal/family-actions";
import type { PortalFamily } from "@/lib/portal/family-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, formText, useErrorText } from "@/components/portal/family/family-ui";

export function PickupSection({ family }: { family: PortalFamily }) {
  const t = useTranslations("portal.family.pickup");
  const errorText = useErrorText();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idPrefix = `pickup-${family.id}`;

  function handleRemove(id: string, name: string) {
    setRemovingId(id);
    startTransition(async () => {
      const result = await removePickupPerson(id);
      setRemovingId(null);
      if (result.ok) toast.success(t("removed", { name }));
      else toast.error(errorText(result.error));
    });
  }

  return (
    <section aria-labelledby={`${idPrefix}-title`} className="grid gap-3 px-5 py-5 sm:px-6">
      <h3 id={`${idPrefix}-title`} className="flex items-center gap-2 font-heading text-lg font-semibold">
        <HandHeart aria-hidden="true" className="size-5 text-brand-green-dark" />
        {t("title")}
      </h3>
      <p className="text-sm text-pretty text-muted-foreground">{t("intro")}</p>
      {family.pickup.length ? (
        <ul className="grid gap-2">
          {family.pickup.map((person) => (
            <li
              key={person.id}
              data-testid="family-pickup"
              className="flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4 ring-1 ring-foreground/10"
            >
              <p className="mr-auto min-w-0 text-sm">
                <span className="block font-semibold">{person.name}</span>
                <span className="block text-muted-foreground">
                  {[person.relation, person.phone].filter(Boolean).join(" · ")}
                </span>
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleRemove(person.id, person.name)}
                disabled={pending}
                aria-label={t("removeLabel", { name: person.name })}
              >
                {removingId === person.id ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">{t("empty")}</p>
      )}
      {family.pickup.length < 10 ? (
        <FormDialog
          trigger={
            <Button type="button" variant="outline" className="w-full sm:w-fit">
              <Plus aria-hidden="true" />
              {t("add")}
            </Button>
          }
          title={t("addTitle")}
          submitLabel={t("add")}
          onSubmit={async (form) => {
            const name = formText(form, "name");
            const result = await addPickupPerson(family.id, {
              name,
              phone: formText(form, "phone"),
              relation: formText(form, "relation"),
            });
            if (result.ok) toast.success(t("added", { name }));
            return result;
          }}
        >
          <Field id={`${idPrefix}-name`} label={t("name")}>
            <Input id={`${idPrefix}-name`} name="name" required maxLength={120} autoComplete="off" />
          </Field>
          <Field id={`${idPrefix}-phone`} label={t("phone")} optional>
            <Input
              id={`${idPrefix}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={40}
              autoComplete="off"
            />
          </Field>
          <Field id={`${idPrefix}-relation`} label={t("relation")} optional>
            <Input
              id={`${idPrefix}-relation`}
              name="relation"
              maxLength={60}
              autoComplete="off"
              placeholder={t("relationPlaceholder")}
            />
          </Field>
        </FormDialog>
      ) : null}
    </section>
  );
}
