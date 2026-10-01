"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { PortalActionResult, PortalErrorCode } from "@/lib/portal/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export function Field({
  id,
  label,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("portal.family");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">({t("optional")})</span> : null}
      </Label>
      {children}
      {hint ? <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function useErrorText() {
  const t = useTranslations("portal");
  return (code: PortalErrorCode) => t(`errors.${code}`);
}

export function FormDialog({
  trigger,
  title,
  description,
  submitLabel,
  onSubmit,
  errorText,
  wide,
  destructive,
  children,
}: {
  trigger: React.ReactElement;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: (form: FormData) => Promise<PortalActionResult>;
  errorText?: (code: PortalErrorCode) => string;
  wide?: boolean;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations("portal.family");
  const defaultErrorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(form);
      if (!result.ok) {
        setError((errorText ?? defaultErrorText)(result.error));
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent
        closeLabel={t("close")}
        className={cn(
          "max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-3xl p-5 sm:max-w-md",
          wide && "sm:max-w-xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 font-heading text-xl font-semibold">{title}</DialogTitle>
          {description ? <DialogDescription className="text-pretty">{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          {children}
          {error ? <ErrorNote message={error} /> : null}
          <DialogFooter className="-mx-5 -mb-5 rounded-b-3xl p-5">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function formText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function RadioPills({
  name,
  legend,
  options,
  defaultValue,
  columns = 2,
  required,
}: {
  name: string;
  legend: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
  columns?: 2 | 3;
  required?: boolean;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-2", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-foreground/10 transition-colors has-checked:bg-primary/10 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              required={required}
              defaultChecked={defaultValue === option.value}
              className="size-4 shrink-0 accent-[var(--brand-green-dark)]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const PHONE_PATTERN = "\\+?[0-9 \\-]{8,20}";
