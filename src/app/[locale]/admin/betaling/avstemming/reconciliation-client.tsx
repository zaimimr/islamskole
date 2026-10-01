"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  CloudDownload,
  HandHeart,
  Link2,
  Loader2,
  MoreHorizontal,
  Search,
  Sparkles,
  Undo2,
  Upload,
  Users,
} from "lucide-react";
import {
  acceptSuggestions,
  bulkMapToSadaqa,
  fetchFromVipps,
  findPaymentCandidates,
  ignoreTransaction,
  importStatementFile,
  linkToPayment,
  mapToFamily,
  mapToSadaqa,
  undoMapping,
  type PaymentCandidate,
} from "./reconciliation-actions";
import { formatNok, kronerToOre } from "@/lib/money";
import { formatOsloDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type InboxTransaction = {
  id: string;
  source: "vipps" | "dnb";
  account: string;
  accountLabel: string;
  bookedOn: string;
  amount: number;
  counterpartyName: string | null;
  counterpartyPhone: string | null;
  message: string | null;
  reference: string | null;
  pspReference: string | null;
  externalId: string;
  status: string;
  suggestedStatus: string | null;
  suggestionReason: string | null;
  note: string | null;
  mappedBy: string | null;
  mappedAt: string | null;
  linkLabel: string | null;
  linkHref: string | null;
};

export type PickerChild = { id: string; name: string; remainingOre: number };
export type PickerFamily = {
  key: string;
  familyId: string | null;
  name: string;
  children: PickerChild[];
};

export type AccountOption = { value: string; label: string };

const footerClass =
  "[&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4";

const statusLabels: Record<string, string> = {
  ny: "Til behandling",
  matchet: "Koblet til betaling",
  sadaqa: "Sadaqa",
  familie: "Skolepenger",
  ignorert: "Ignorert",
};

const suggestionLabels: Record<string, string> = {
  sadaqa: "Forslag: sadaqa",
  ignorert: "Forslag: ignorer",
  matchet: "Forslag: koble",
  familie: "Forslag: skolepenger",
};

const statusTone: Record<string, string> = {
  ny: "bg-[#FEEDCA] text-[#775108]",
  matchet: "bg-[#DCEDDD] text-[#216A2B]",
  sadaqa: "bg-[#E4EEF9] text-[#24507A]",
  familie: "bg-[#DCEDDD] text-[#216A2B]",
  ignorert: "bg-[#F0F0ED] text-[#4E5550]",
};

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-admin-muted">{label}</dt>
      <dd className="break-all text-sm">{value}</dd>
    </div>
  );
}

export function ImportPanel({
  vippsAccounts,
  dnbAccount,
}: {
  vippsAccounts: AccountOption[];
  dnbAccount: string;
}) {
  const router = useRouter();
  const [fetching, startFetch] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("vipps");
  const [vippsAccount, setVippsAccount] = useState("");
  const [bankAccount, setBankAccount] = useState(dnbAccount);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);

  function fetchVipps() {
    startFetch(async () => {
      const result = await fetchFromVipps({
        from: from || undefined,
        to: to || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const inserted = result.accounts.reduce((sum, row) => sum + row.inserted, 0);
      const matched = result.accounts.reduce((sum, row) => sum + row.matched, 0);
      const errors = result.accounts.flatMap((row) => (row.error ? [row.error] : []));
      setFetchErrors(errors);
      if (errors.length === result.accounts.length) {
        toast.error("Fikk ikke hentet fra Vipps", { description: errors[0] });
      } else {
        toast.success(`${inserted} nye transaksjoner fra Vipps`, {
          description: matched > 0 ? `${matched} koblet automatisk til betalinger` : undefined,
        });
      }
      router.refresh();
    });
  }

  function upload() {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("source", source);
    data.set("account", source === "dnb" ? bankAccount : vippsAccount);
    startUpload(async () => {
      const result = await importStatementFile(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { summary } = result;
      toast.success(`${summary.inserted} nye av ${summary.rows} transaksjoner`, {
        description: [
          summary.duplicates > 0 ? `${summary.duplicates} fantes fra før` : null,
          summary.matched > 0 ? `${summary.matched} koblet automatisk` : null,
          summary.errors.length > 0 ? `${summary.errors.length} linjer kunne ikke leses` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      });
      setFile(null);
      setInputKey((key) => key + 1);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="vipps-fetch"
        className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5"
      >
        <div>
          <h2 id="vipps-fetch" className="font-heading text-lg font-bold">
            Hent fra Vipps
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted">
            Henter innbetalinger for {vippsAccounts.map((option) => option.value).join(", ")}.
            Uten datoer hentes alt siden forrige henting.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="vipps-from">Fra (valgfritt)</Label>
            <Input
              id="vipps-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vipps-to">Til (valgfritt)</Label>
            <Input
              id="vipps-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={fetchVipps}
          disabled={fetching}
          className="min-h-11 rounded-xl px-3 font-bold"
        >
          {fetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CloudDownload className="size-4" />
          )}
          Hent fra Vipps
        </Button>
        {fetchErrors.length > 0 ? (
          <ul className="grid gap-1.5 rounded-xl bg-[#FFF8E9] px-3 py-2 text-sm text-[#6B5524] ring-1 ring-[#E8D6AA]">
            {fetchErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="file-import"
        className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5"
      >
        <div>
          <h2 id="file-import" className="font-heading text-lg font-bold">
            Last opp eksport
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted">
            CSV eller Excel fra Vipps-portalen eller DNB nettbank. Linjer som
            allerede er lastet opp hoppes over.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="import-source">Hvor kommer filen fra?</Label>
          <SelectField
            id="import-source"
            value={source}
            onValueChange={setSource}
            options={[
              { value: "vipps", label: "Vipps-portalen" },
              { value: "dnb", label: "DNB nettbank" },
            ]}
          />
        </div>
        {source === "vipps" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="import-msn">Salgssted</Label>
            <SelectField
              id="import-msn"
              value={vippsAccount}
              onValueChange={setVippsAccount}
              options={[
                { value: "", label: "Les fra filen" },
                ...vippsAccounts,
              ]}
            />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="import-account" required>
              Kontonummer
            </Label>
            <Input
              id="import-account"
              inputMode="numeric"
              value={bankAccount}
              onChange={(event) => setBankAccount(event.target.value)}
              placeholder="1234.56.78901"
              className="h-11 rounded-xl"
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="import-file" required>
            Fil
          </Label>
          <Input
            key={inputKey}
            id="import-file"
            type="file"
            accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-11 rounded-xl pt-2"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={upload}
          disabled={uploading || !file}
          className="min-h-11 rounded-xl px-3 font-bold"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Last opp
        </Button>
      </section>
    </div>
  );
}

type DialogState =
  | { kind: "sadaqa"; transaction: InboxTransaction }
  | { kind: "family"; transaction: InboxTransaction }
  | { kind: "link"; transaction: InboxTransaction }
  | { kind: "ignore"; transaction: InboxTransaction }
  | { kind: "undo"; transaction: InboxTransaction }
  | null;

export function TransactionInbox({
  transactions,
  families,
  giftFamilies,
  schoolYearId,
  schoolYearLabel,
}: {
  transactions: InboxTransaction[];
  families: PickerFamily[];
  giftFamilies: { id: string; name: string }[];
  schoolYearId: string | null;
  schoolYearLabel: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [bulkPending, startBulk] = useTransition();
  const [quickPending, startQuick] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const open = transactions.filter((row) => row.status === "ny");
  const selectedRows = open.filter((row) => selected.has(row.id));
  const withSuggestion = selectedRows.filter(
    (row) => row.suggestedStatus === "sadaqa" || row.suggestedStatus === "ignorert",
  );
  const incoming = selectedRows.filter((row) => row.amount > 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDetails(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(kind: "suggestions" | "sadaqa") {
    const ids = (kind === "suggestions" ? withSuggestion : incoming).map((row) => row.id);
    startBulk(async () => {
      const result =
        kind === "suggestions" ? await acceptSuggestions(ids) : await bulkMapToSadaqa(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.failed.length > 0) {
        toast.warning(`${result.done} behandlet, ${result.failed.length} feilet`, {
          description: result.failed[0],
        });
      } else {
        toast.success(`${result.done} transaksjoner behandlet`);
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function acceptOne(row: InboxTransaction) {
    startQuick(async () => {
      const result = await acceptSuggestions([row.id]);
      if (!result.ok) toast.error(result.error);
      else if (result.failed.length > 0) toast.error(result.failed[0]);
      else toast.success("Forslaget er godtatt");
      router.refresh();
    });
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-[#E3DED3]">
        <p className="font-heading text-lg font-semibold">Ingen transaksjoner her</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-admin-muted">
          Hent fra Vipps eller last opp en eksport for å komme i gang, eller
          endre filteret.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {selectedRows.length > 0 ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-[#E3DED3] backdrop-blur">
          <p className="mr-auto text-sm font-bold">
            {selectedRows.length} valgt ·{" "}
            {formatNok(selectedRows.reduce((sum, row) => sum + row.amount, 0))}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={bulkPending || withSuggestion.length === 0}
            onClick={() => runBulk("suggestions")}
            className="min-h-11 rounded-xl px-3 font-bold"
          >
            <Sparkles className="size-4" />
            Godta forslag ({withSuggestion.length})
          </Button>
          <Button
            type="button"
            disabled={bulkPending || incoming.length === 0}
            onClick={() => runBulk("sadaqa")}
            className="min-h-11 rounded-xl px-3 font-bold"
          >
            {bulkPending ? <Loader2 className="size-4 animate-spin" /> : <HandHeart className="size-4" />}
            Før som sadaqa ({incoming.length})
          </Button>
        </div>
      ) : null}

      <ul className="divide-y divide-[#ECE8DF] overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
        {transactions.map((row) => {
          const isOpen = row.status === "ny";
          const showDetails = expanded.has(row.id);
          return (
            <li key={row.id} className="grid gap-2 px-4 py-3 sm:px-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                {isOpen ? (
                  <input
                    type="checkbox"
                    aria-label={`Velg ${formatNok(row.amount)} fra ${row.counterpartyName ?? "ukjent"}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    className="mt-1.5 size-4 accent-[#3C8F44]"
                  />
                ) : (
                  <span className="size-4" />
                )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-bold">
                      {row.counterpartyName || (row.source === "dnb" ? "Bankoverføring" : "Ukjent betaler")}
                    </span>
                    <span className="rounded-full bg-[#F0F0ED] px-2 py-0.5 text-xs font-bold text-[#4E5550]">
                      {row.accountLabel}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        statusTone[row.status] ?? statusTone.ny,
                      )}
                    >
                      {statusLabels[row.status] ?? row.status}
                    </span>
                    {isOpen && row.suggestedStatus ? (
                      <span className="rounded-full bg-[#F4EEFB] px-2 py-0.5 text-xs font-bold text-[#5A3A85]">
                        {suggestionLabels[row.suggestedStatus] ?? row.suggestedStatus}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-admin-muted">
                    {formatOsloDate(row.bookedOn)}
                    {row.message ? ` · ${row.message}` : ""}
                  </p>
                  {!isOpen ? (
                    <p className="mt-0.5 text-sm">
                      {row.linkHref ? (
                        <a
                          href={row.linkHref}
                          className="font-semibold text-[#277A31] outline-none underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.linkLabel}
                        </a>
                      ) : (
                        row.linkLabel
                      )}
                      {row.note ? (
                        <span className="text-admin-muted">
                          {row.linkLabel ? " · " : ""}
                          {row.note}
                        </span>
                      ) : null}
                    </p>
                  ) : row.note ? (
                    <p className="mt-0.5 text-sm text-admin-muted">{row.note}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <p
                    className={cn(
                      "font-heading text-lg font-bold tabular-nums",
                      row.amount < 0 && "text-[#8B2F2B]",
                    )}
                  >
                    {formatNok(row.amount)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Handlinger"
                          className="text-admin-muted hover:text-foreground"
                        />
                      }
                    >
                      <MoreHorizontal aria-hidden="true" className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-auto min-w-52">
                      {isOpen && row.amount > 0 ? (
                        <>
                          <DropdownMenuItem onClick={() => setDialog({ kind: "sadaqa", transaction: row })}>
                            <HandHeart className="size-4" />
                            Før som sadaqa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!schoolYearId}
                            onClick={() => setDialog({ kind: "family", transaction: row })}
                          >
                            <Users className="size-4" />
                            Før som skolepenger for familie
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {isOpen ? (
                        <>
                          <DropdownMenuItem onClick={() => setDialog({ kind: "link", transaction: row })}>
                            <Link2 className="size-4" />
                            Koble til eksisterende betaling
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDialog({ kind: "ignore", transaction: row })}>
                            <Ban className="size-4" />
                            Ignorer
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDialog({ kind: "undo", transaction: row })}
                        >
                          <Undo2 className="size-4" />
                          Angre behandling
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-7">
                {isOpen && row.suggestedStatus && (row.suggestedStatus !== "sadaqa" || row.amount > 0) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={quickPending}
                    onClick={() => acceptOne(row)}
                    className="min-h-9 rounded-lg px-2.5 font-bold"
                    title={row.suggestionReason ?? undefined}
                  >
                    <Sparkles className="size-4" />
                    {row.suggestedStatus === "sadaqa" ? "Før som sadaqa" : "Ignorer"}
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleDetails(row.id)}
                  aria-expanded={showDetails}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-admin-muted outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Detaljer
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-4 transition-transform", showDetails && "rotate-180")}
                  />
                </button>
              </div>
              {showDetails ? (
                <dl className="ml-7 grid gap-3 rounded-xl bg-[#FAF9F5] px-3 py-3 ring-1 ring-[#E8E3D9] sm:grid-cols-3">
                  <Detail label="Telefon" value={row.counterpartyPhone} />
                  <Detail label="Ordre-ID" value={row.reference} />
                  <Detail label="Transaksjons-ID" value={row.pspReference} />
                  <Detail label="Ekstern ID" value={row.externalId} />
                  <Detail label="Forslag" value={row.suggestionReason} />
                  <Detail label="Behandlet av" value={row.mappedBy} />
                  <Detail
                    label="Behandlet"
                    value={row.mappedAt ? formatOsloDate(row.mappedAt) : null}
                  />
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>

      {dialog?.kind === "sadaqa" ? (
        <SadaqaMapDialog
          transaction={dialog.transaction}
          families={giftFamilies}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "family" && schoolYearId ? (
        <FamilyMapDialog
          transaction={dialog.transaction}
          families={families}
          schoolYearId={schoolYearId}
          schoolYearLabel={schoolYearLabel}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "link" ? (
        <LinkPaymentDialog transaction={dialog.transaction} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "ignore" ? (
        <IgnoreDialog transaction={dialog.transaction} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "undo" ? (
        <UndoDialog transaction={dialog.transaction} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function useAction(onClose: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

function TransactionSummary({ transaction }: { transaction: InboxTransaction }) {
  return (
    <p className="rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]">
      <span className="font-bold">{formatNok(transaction.amount)}</span> fra{" "}
      {transaction.counterpartyName ?? "ukjent"} · {transaction.accountLabel} ·{" "}
      {formatOsloDate(transaction.bookedOn)}
      {transaction.message ? (
        <span className="block text-admin-muted">{transaction.message}</span>
      ) : null}
    </p>
  );
}

function SadaqaMapDialog({
  transaction,
  families,
  onClose,
}: {
  transaction: InboxTransaction;
  families: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { pending, run } = useAction(onClose);
  const [donorName, setDonorName] = useState(transaction.counterpartyName ?? "");
  const [familyId, setFamilyId] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Før som sadaqa-gave</DialogTitle>
          <DialogDescription>
            Beløpet registreres som en gave i sadaqa-oversikten.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <TransactionSummary transaction={transaction} />
          <div className="grid gap-1.5">
            <Label htmlFor="map-sadaqa-donor">Fra</Label>
            <Input
              id="map-sadaqa-donor"
              value={donorName}
              onChange={(event) => setDonorName(event.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          {families.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="map-sadaqa-family">Familie (valgfritt)</Label>
              <SelectField
                id="map-sadaqa-family"
                value={familyId}
                onValueChange={setFamilyId}
                options={[
                  { value: "", label: "Ingen familie" },
                  ...families.map((option) => ({ value: option.id, label: option.name })),
                ]}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="map-sadaqa-note">Notat (valgfritt)</Label>
            <Input
              id="map-sadaqa-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className={footerClass}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Avbryt
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  mapToSadaqa({
                    id: transaction.id,
                    donorName: donorName.trim() || undefined,
                    familyId: familyId || undefined,
                    note: note.trim() || undefined,
                  }),
                `${formatNok(transaction.amount)} er ført som sadaqa`,
              )
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Før som sadaqa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function prefillShares(children: PickerChild[], totalOre: number): string[] {
  let left = totalOre;
  const shares = children.map((child) => {
    const share = Math.min(Math.max(child.remainingOre, 0), left);
    left -= share;
    return share;
  });
  if (left > 0 && shares.length > 0) shares[0] += left;
  return shares.map((share) => (share > 0 ? String(share / 100) : ""));
}

function FamilyMapDialog({
  transaction,
  families,
  schoolYearId,
  schoolYearLabel,
  onClose,
}: {
  transaction: InboxTransaction;
  families: PickerFamily[];
  schoolYearId: string;
  schoolYearLabel: string | null;
  onClose: () => void;
}) {
  const { pending, run } = useAction(onClose);
  const [query, setQuery] = useState(transaction.counterpartyName?.split(" ").pop() ?? "");
  const [family, setFamily] = useState<PickerFamily | null>(null);
  const [shares, setShares] = useState<string[]>([]);

  function choose(next: PickerFamily | null) {
    setFamily(next);
    setShares(next ? prefillShares(next.children, transaction.amount) : []);
  }

  const term = query.trim().toLocaleLowerCase("nb-NO");
  const matches = (
    term
      ? families.filter((option) =>
          [option.name, ...option.children.map((child) => child.name)]
            .join(" ")
            .toLocaleLowerCase("nb-NO")
            .includes(term),
        )
      : families.filter((option) => option.children.some((child) => child.remainingOre > 0))
  ).slice(0, 8);

  const children = family?.children ?? [];
  const allocated = shares.reduce((sum, value) => sum + kronerToOre(Number(value) || 0), 0);
  const rest = transaction.amount - allocated;

  function save() {
    if (!family) return;
    const split = children
      .map((child, index) => ({ studentId: child.id, amount: kronerToOre(Number(shares[index]) || 0) }))
      .filter((line) => line.amount > 0);
    run(
      () =>
        mapToFamily({
          id: transaction.id,
          schoolYearId,
          familyId: family.familyId,
          familyName: family.name.replace(/^Familien\s+/, ""),
          split,
        }),
      `${formatNok(transaction.amount)} er ført som skolepenger for ${family.name}`,
    );
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {family ? `Skolepenger for ${family.name}` : "Hvilken familie har betalt?"}
          </DialogTitle>
          <DialogDescription>
            Registreres som en betaling for familien
            {schoolYearLabel ? ` i ${schoolYearLabel}` : ""}, fordelt på barna,
            på samme måte som en manuell betaling.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <TransactionSummary transaction={transaction} />
          {!family ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="map-family-search">Finn familie eller barn</Label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#3C8F44]"
                  />
                  <Input
                    id="map-family-search"
                    autoFocus
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Skriv navn"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>
              </div>
              {matches.length === 0 ? (
                <p className="rounded-xl bg-[#FAF9F5] px-3 py-3 text-sm text-admin-muted ring-1 ring-[#E8E3D9]">
                  Ingen familie eller barn passer søket.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {matches.map((option) => {
                    const remaining = option.children.reduce(
                      (sum, child) => sum + Math.max(child.remainingOre, 0),
                      0,
                    );
                    return (
                      <li key={option.key}>
                        <button
                          type="button"
                          onClick={() => choose(option)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-[#FAF9F5] px-3 py-2 text-left text-sm ring-1 ring-[#E8E3D9] outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{option.name}</span>
                            <span className="block truncate text-xs text-admin-muted">
                              {option.children.map((child) => child.name).join(", ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-admin-muted">
                            {remaining > 0 ? `Gjenstår ${formatNok(remaining)}` : "Ferdig betalt"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => choose(null)}
                className="inline-flex min-h-11 items-center gap-1.5 justify-self-start rounded-lg px-1 text-sm font-bold text-[#277A31] outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Velg en annen familie
              </button>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-bold">Fordeling på barn</legend>
                {children.map((child, index) => (
                  <div
                    key={child.id}
                    className="grid grid-cols-[1fr_7.5rem] items-center gap-3 rounded-xl bg-[#FAF9F5] px-3 py-2 ring-1 ring-[#E8E3D9]"
                  >
                    <Label htmlFor={`map-share-${child.id}`} className="grid gap-0.5">
                      <span className="font-bold">{child.name}</span>
                      <span className="text-xs font-normal text-admin-muted">
                        {child.remainingOre > 0
                          ? `Gjenstår ${formatNok(child.remainingOre)}`
                          : "Ingenting igjen å betale"}
                      </span>
                    </Label>
                    <Input
                      id={`map-share-${child.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={shares[index] ?? ""}
                      onChange={(event) =>
                        setShares((current) =>
                          current.map((value, i) => (i === index ? event.target.value : value)),
                        )
                      }
                      className="h-11 rounded-xl text-right tabular-nums"
                    />
                  </div>
                ))}
              </fieldset>
              <p
                aria-live="polite"
                className={cn(
                  "rounded-xl px-3 py-2 text-sm ring-1",
                  rest === 0
                    ? "bg-[#F2F8F2] text-[#216A2B] ring-[#C9E0CB]"
                    : "bg-[#F9DEDB] text-[#8B2F2B] ring-[#E8B9B5]",
                )}
              >
                Fordelt {formatNok(allocated)} av {formatNok(transaction.amount)}
                {rest > 0 ? `. Fordel ${formatNok(rest)} til.` : ""}
                {rest < 0 ? `. ${formatNok(Math.abs(rest))} for mye.` : ""}
              </p>
            </>
          )}
        </div>
        <DialogFooter className={footerClass}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Avbryt
          </Button>
          <Button type="button" onClick={save} disabled={pending || !family || rest !== 0}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Registrer {formatNok(transaction.amount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkPaymentDialog({
  transaction,
  onClose,
}: {
  transaction: InboxTransaction;
  onClose: () => void;
}) {
  const { pending, run } = useAction(onClose);
  const [searching, startSearch] = useTransition();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PaymentCandidate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    findPaymentCandidates({ id: transaction.id }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCandidates(result.candidates);
      } else {
        setCandidates([]);
        toast.error(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [transaction.id]);

  function search(term: string) {
    startSearch(async () => {
      const result = await findPaymentCandidates({ id: transaction.id, query: term || undefined });
      if (result.ok) setCandidates(result.candidates);
      else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Koble til eksisterende betaling</DialogTitle>
          <DialogDescription>
            Bruk dette når betalingen allerede er registrert i systemet. Ingenting
            nytt blir ført.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <TransactionSummary transaction={transaction} />
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              search(query.trim());
            }}
          >
            <Input
              aria-label="Søk på navn eller referanse"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søk på navn eller referanse"
              className="h-11 rounded-xl"
            />
            <Button type="submit" variant="outline" disabled={searching} className="min-h-11 rounded-xl">
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Søk
            </Button>
          </form>
          <p className="text-xs font-bold text-admin-muted">
            {query.trim() ? "Treff" : "Samme beløp innen ti dager"}
          </p>
          {candidates === null ? (
            <p className="text-sm text-admin-muted">Leter …</p>
          ) : candidates.length === 0 ? (
            <p className="rounded-xl bg-[#FAF9F5] px-3 py-3 text-sm text-admin-muted ring-1 ring-[#E8E3D9]">
              Fant ingen ledige betalinger.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => linkToPayment({ id: transaction.id, paymentId: candidate.id }),
                        "Transaksjonen er koblet til betalingen",
                      )
                    }
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-[#FAF9F5] px-3 py-2 text-left text-sm ring-1 ring-[#E8E3D9] outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {candidate.payerName || candidate.description || candidate.reference}
                      </span>
                      <span className="block truncate text-xs text-admin-muted">
                        {candidate.paidAt ? formatOsloDate(candidate.paidAt) : "Uten dato"} ·{" "}
                        {candidate.reference}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatNok(candidate.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className={footerClass}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Lukk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IgnoreDialog({
  transaction,
  onClose,
}: {
  transaction: InboxTransaction;
  onClose: () => void;
}) {
  const { pending, run } = useAction(onClose);
  const [reason, setReason] = useState(transaction.suggestionReason ?? "");

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ignorer transaksjonen</DialogTitle>
          <DialogDescription>
            Den teller ikke som sadaqa eller skolepenger. Du kan angre senere.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <TransactionSummary transaction={transaction} />
          <div className="grid gap-1.5">
            <Label htmlFor="ignore-reason" required>
              Hvorfor?
            </Label>
            <Input
              id="ignore-reason"
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="For eksempel utbetaling fra Vipps"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className={footerClass}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Avbryt
          </Button>
          <Button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() =>
              run(
                () => ignoreTransaction({ id: transaction.id, reason: reason.trim() }),
                "Transaksjonen er ignorert",
              )
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Ignorer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UndoDialog({
  transaction,
  onClose,
}: {
  transaction: InboxTransaction;
  onClose: () => void;
}) {
  const { pending, run } = useAction(onClose);
  const description =
    transaction.status === "sadaqa"
      ? "Sadaqa-gaven annulleres og transaksjonen legges tilbake til behandling."
      : transaction.status === "familie"
        ? "Betalingen som ble registrert annulleres, så familien står med det samme utestående som før."
        : "Transaksjonen legges tilbake til behandling. Ingen betalinger endres.";

  return (
    <AlertDialog open onOpenChange={(next) => (next ? null : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-2xl">
            Angre behandlingen av {formatNok(transaction.amount)}?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={footerClass}>
          <AlertDialogCancel disabled={pending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() => run(() => undoMapping(transaction.id), "Behandlingen er angret")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Angre
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
