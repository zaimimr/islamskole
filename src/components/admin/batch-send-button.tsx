"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Loader2, Send } from "lucide-react";
import {
  batchSendPaymentLinks,
  previewBatchSend,
  type BatchPreview,
} from "@/app/[locale]/admin/students-actions";
import type { BatchExclusionReason } from "@/lib/payment-integrity";
import { formatNok } from "@/lib/money";
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

const reasonLabels: Record<BatchExclusionReason, string> = {
  fritatt: "Skal ikke betale",
  betalt: "Allerede betalt",
  plan: "På betalingsplan, får avdrag automatisk",
  uten_pris: "Mangler pris for skoleåret",
  apen_lenke: "Har allerede en åpen betalingslenke",
  ingen_epost: "Ingen foresatte med e-post som mottar varsler",
};

type ReadyPreview = Extract<BatchPreview, { ok: true }>;

export function BatchSendButton({
  schoolYearId,
  yearLabel,
}: {
  schoolYearId: string;
  yearLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ReadyPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  function load() {
    setPreview(null);
    setLoadError(null);
    startLoading(async () => {
      const result = await previewBatchSend(schoolYearId);
      if (result.ok) {
        setPreview(result);
        const shared = sharedRecipientKeys(result.families);
        setSelected(
          new Set(
            result.families
              .map((family) => family.familyKey)
              .filter((key) => !shared.has(key)),
          ),
        );
      } else {
        setLoadError(result.error);
      }
    });
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSend() {
    startSending(async () => {
      const result = await batchSendPaymentLinks(schoolYearId, [...selected]);
      if (result.ok) {
        const summary = `Betalingslenke sendt til ${result.sent} ${
          result.sent === 1 ? "familie" : "familier"
        }${result.note ? ` · ${result.note}` : ""}`;
        if (result.failed > 0) toast.warning(summary);
        else toast.success(summary);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const chosen = preview
    ? preview.families.filter((family) => selected.has(family.familyKey))
    : [];
  const chosenAmount = chosen.reduce((sum, family) => sum + family.amount, 0);
  const sharedKeys = sharedRecipientKeys(preview?.families ?? []);
  const excludedByReason = new Map<BatchExclusionReason, string[]>();
  for (const item of preview?.excluded ?? []) {
    const names = excludedByReason.get(item.reason) ?? [];
    names.push(item.name);
    excludedByReason.set(item.reason, names);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className="min-h-11 bg-white px-3">
            <Send className="size-4" />
            Send betalingslenke til ubetalte
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            Send betalingslenker for {yearLabel}
          </DialogTitle>
          <DialogDescription>
            Hver familie får én e-post og én Vipps-betaling for det som
            gjenstår for alle barna. Se over listen før du sender.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-6 text-admin-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Henter familier og beløp …
          </p>
        ) : loadError ? (
          <div className="grid gap-3 py-2">
            <p role="alert" className="font-bold text-[#8B2F2B]">
              {loadError}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start rounded-xl px-4"
              onClick={load}
            >
              Prøv igjen
            </Button>
          </div>
        ) : preview ? (
          <div className="grid gap-4 text-sm">
            {!preview.emailEnabled ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-[#FFF8E9] px-4 py-3 text-[#6B5524] ring-1 ring-[#E8D6AA]"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                E-postvarsler er slått av. Slå dem på før du sender
                betalingslenker.
              </p>
            ) : null}

            <div className="rounded-xl bg-[#FAF9F5] px-4 py-3 ring-1 ring-[#E8E3D9]">
              <p className="font-heading text-2xl font-bold tabular-nums">
                {formatNok(chosenAmount)}
              </p>
              <p className="text-admin-muted">
                til {chosen.length} av {preview.families.length}{" "}
                {preview.families.length === 1 ? "familie" : "familier"}
                {preview.excluded.length > 0
                  ? ` · ${preview.excluded.length} barn hoppes over`
                  : ""}
              </p>
            </div>

            {preview.families.length === 0 ? (
              <p className="text-admin-muted">
                Ingen familier har noe utestående som kan sendes nå.
              </p>
            ) : (
              <ul className="grid gap-2" aria-label="Familier som får betalingslenke">
                {preview.families.map((family) => {
                  const checked = selected.has(family.familyKey);
                  const inputId = `batch-${family.familyKey}`;
                  return (
                    <li key={family.familyKey}>
                      <label
                        htmlFor={inputId}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ${
                          checked
                            ? "bg-white ring-[#C9E0CB]"
                            : "bg-[#FAF9F5] text-admin-muted ring-[#E8E3D9]"
                        }`}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(family.familyKey)}
                          className="mt-1 size-4 accent-[#3C8F44]"
                        />
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-bold">
                              {family.familyName ?? "Familie uten navn"}
                            </span>
                            <span className="font-bold tabular-nums">
                              {formatNok(family.amount)}
                            </span>
                          </span>
                          <span className="text-xs text-admin-muted">
                            {family.children
                              .map(
                                (child) =>
                                  `${child.name} ${formatNok(child.amount)}`,
                              )
                              .join(" · ")}
                          </span>
                          <span className="text-xs text-admin-muted">
                            Til {family.recipients.join(", ")}
                          </span>
                          {sharedKeys.has(family.familyKey) ? (
                            <span className="text-xs font-semibold text-[#8A5A00]">
                              Samme e-post som en annen familie. Sjekk om
                              familiene er registrert dobbelt før du sender.
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {excludedByReason.size > 0 ? (
              <details className="group rounded-xl ring-1 ring-[#E8E3D9]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 font-bold">
                  Hoppes over ({preview.excluded.length})
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <dl className="grid gap-3 px-3 pb-3">
                  {[...excludedByReason].map(([reason, names]) => (
                    <div key={reason}>
                      <dt className="text-xs font-bold text-admin-muted">
                        {reasonLabels[reason]} ({names.length})
                      </dt>
                      <dd>{names.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={
              sending ||
              loading ||
              !preview?.emailEnabled ||
              chosen.length === 0
            }
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send til {chosen.length}{" "}
            {chosen.length === 1 ? "familie" : "familier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sharedRecipientKeys(
  families: { familyKey: string; recipients: string[] }[],
): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const family of families) {
    for (const email of family.recipients) {
      const key = email.trim().toLowerCase();
      owners.set(key, (owners.get(key) ?? new Set()).add(family.familyKey));
    }
  }
  const shared = new Set<string>();
  for (const keys of owners.values()) {
    if (keys.size > 1) for (const key of keys) shared.add(key);
  }
  return shared;
}
