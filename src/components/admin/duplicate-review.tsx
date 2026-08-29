"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  GitCompareArrows,
  Loader2,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import {
  keepPaymentAsSeparate,
  markPaymentAsDuplicate,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";

export type DuplicateCandidate = {
  paymentId: string;
  matchedPaymentId: string;
  childName: string;
  schoolYear: string | null;
  amount: number;
  manualDescription: string | null;
  manualPaidAt: string | null;
  manualMethod: string;
  matchedReference: string;
  matchedCreatedAt: string | null;
  citedReference: string | null;
  evidence: string;
};

function formatNok(ore: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(ore / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Dato mangler";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Dato mangler";
  return date.toLocaleDateString("nb-NO", {
    dateStyle: "medium",
    timeZone: "Europe/Oslo",
  });
}

const methodLabels: Record<string, string> = {
  vipps: "Vipps",
  kontant: "Kontant",
  bank: "Bankoverføring",
  annet: "Annet",
};

export function DuplicateReview({
  candidates,
}: {
  candidates: DuplicateCandidate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function run(
    paymentId: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setPendingId(paymentId);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Noe gikk galt");
      }
      setPendingId(null);
    });
  }

  if (candidates.length === 0) {
    return (
      <section className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-[#E3DED3]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </span>
        <h2 className="mt-4 font-heading text-xl font-semibold">
          Ingen dobbeltføringer til kontroll
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-admin-muted">
          Alle foreslåtte treff er behandlet. Nye mulige dobbeltføringer vises
          her automatisk.
        </p>
      </section>
    );
  }

  return (
    <ol className="grid gap-4">
      {candidates.map((candidate, index) => {
        const exactReference = candidate.evidence === "cited_reference";
        const working = pending && pendingId === candidate.paymentId;

        return (
          <li
            key={candidate.paymentId}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-xl font-semibold">
                    {candidate.childName}
                  </h2>
                  <span className="rounded-full bg-[#F0F0ED] px-2.5 py-1 text-xs font-bold text-[#4E5550]">
                    Sak {index + 1} av {candidates.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-admin-muted">
                  {candidate.schoolYear ?? "Ukjent skoleår"} ·{" "}
                  <span className="font-bold text-foreground tabular-nums">
                    {formatNok(candidate.amount)}
                  </span>{" "}
                  kan være telt to ganger
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  exactReference
                    ? "bg-[#DCEDDD] text-[#216A2B]"
                    : "bg-[#FEEDCA] text-[#775108]"
                }`}
              >
                {exactReference ? (
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                ) : (
                  <GitCompareArrows aria-hidden="true" className="size-3.5" />
                )}
                {exactReference
                  ? "Referansen samsvarer"
                  : "Vipps er nevnt i notatet"}
              </span>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:p-5">
              <PaymentEvidence
                title="Registrert fra Vipps"
                icon={ShieldCheck}
                date={formatDate(candidate.matchedCreatedAt)}
                amount={candidate.amount}
                detail={candidate.matchedReference}
                mono
              />
              <span className="flex items-center justify-center text-admin-muted">
                <GitCompareArrows aria-hidden="true" className="size-5" />
              </span>
              <PaymentEvidence
                title={`Registrert manuelt, ${
                  methodLabels[candidate.manualMethod] ?? candidate.manualMethod
                }`}
                icon={ReceiptText}
                date={formatDate(candidate.manualPaidAt)}
                amount={candidate.amount}
                detail={candidate.manualDescription ?? "Notat mangler"}
              />
            </div>

            <div className="grid gap-3 bg-[#FAF9F5] px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
              <p className="max-w-2xl text-sm text-admin-muted">
                Velg «Tell bare Vipps-betalingen» hvis den manuelle raden er en
                kopi. Velg «Behold som to betalinger» bare når familien faktisk
                har betalt to ganger.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:px-4 [&_[data-slot=button]]:font-bold">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      candidate.paymentId,
                      () => keepPaymentAsSeparate(candidate.paymentId),
                      "Beholdt som to separate betalinger",
                    )
                  }
                >
                  Behold som to betalinger
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      candidate.paymentId,
                      () =>
                        markPaymentAsDuplicate(
                          candidate.paymentId,
                          candidate.matchedPaymentId,
                        ),
                      "Den manuelle raden teller ikke lenger",
                    )
                  }
                >
                  {working ? <Loader2 className="size-4 animate-spin" /> : null}
                  Tell bare Vipps-betalingen
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PaymentEvidence({
  title,
  icon: Icon,
  date,
  amount,
  detail,
  mono = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  date: string;
  amount: number;
  detail: string;
  mono?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-xl bg-[#FAF9F5] p-4 ring-1 ring-[#E8E3D9]">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Icon aria-hidden={true} className="size-4 text-[#277A31]" />
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-admin-muted">{date}</p>
        <p className="font-heading text-xl font-bold tabular-nums">
          {formatNok(amount)}
        </p>
      </div>
      <p
        className={`mt-3 break-words text-xs text-admin-muted ${
          mono ? "font-mono" : ""
        }`}
        title={detail}
      >
        {detail}
      </p>
    </section>
  );
}
