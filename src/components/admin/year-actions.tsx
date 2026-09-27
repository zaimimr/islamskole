"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { syncAllPaymentsForYear } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";

export function YearActions({ schoolYearId }: { schoolYearId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function syncAll() {
    startTransition(async () => {
      const result = await syncAllPaymentsForYear(schoolYearId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.failed.length) {
        toast.warning(
          `Oppdaterte ${result.synced} betalinger. ${result.failed.length} kunne ikke hentes fra Vipps: ${result.failed
            .map((item) => item.reference)
            .join(", ")}`,
        );
      } else {
        toast.success(`Oppdaterte ${result.synced} betalinger`);
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={syncAll}
      className="min-h-11 bg-white px-3"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Synkroniser betalinger
    </Button>
  );
}
