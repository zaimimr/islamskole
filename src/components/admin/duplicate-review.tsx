"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  markPaymentAsDuplicate,
  keepPaymentAsSeparate,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
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

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Noe gikk galt");
      }
    });
  }

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Ingen mistenkte dobbeltføringer igjen. Alt er gjennomgått.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {candidates.map((candidate) => (
        <Card key={candidate.paymentId}>
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{candidate.childName}</p>
                <p className="text-sm text-muted-foreground">
                  {candidate.schoolYear ?? "Ukjent skoleår"} ·{" "}
                  {formatNok(candidate.amount)} registrert to ganger
                </p>
              </div>
              <Badge
                variant={
                  candidate.evidence === "cited_reference"
                    ? "default"
                    : "secondary"
                }
              >
                {candidate.evidence === "cited_reference"
                  ? "Notatet viser til Vipps-referansen"
                  : "Notatet nevner Vipps"}
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Vipps-betaling</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(candidate.matchedCreatedAt)} ·{" "}
                  {formatNok(candidate.amount)}
                </p>
                <p
                  className="mt-1 truncate font-mono text-xs text-muted-foreground"
                  title={candidate.matchedReference}
                >
                  {candidate.matchedReference}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  Manuell registrering (
                  {methodLabels[candidate.manualMethod] ??
                    candidate.manualMethod}
                  )
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(candidate.manualPaidAt)} ·{" "}
                  {formatNok(candidate.amount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {candidate.manualDescription ?? "-"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => keepPaymentAsSeparate(candidate.paymentId),
                    "Beholdt som to separate betalinger",
                  )
                }
              >
                Behold begge
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      markPaymentAsDuplicate(
                        candidate.paymentId,
                        candidate.matchedPaymentId,
                      ),
                    "Markert som dobbeltføring",
                  )
                }
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Dobbeltføring
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
