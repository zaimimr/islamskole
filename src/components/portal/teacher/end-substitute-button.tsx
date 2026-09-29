"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { endSubstitute } from "@/lib/portal/teacher-actions";
import { Button } from "@/components/ui/button";

export function EndSubstituteButton({ classId }: { classId: string }) {
  const t = useTranslations("portal.teacher.substitute");
  const tErrors = useTranslations("portal.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await endSubstitute(classId);
          if (!result.ok) {
            toast.error(tErrors(result.error));
            return;
          }
          router.push("/min-side");
        })
      }
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {t("end")}
    </Button>
  );
}
