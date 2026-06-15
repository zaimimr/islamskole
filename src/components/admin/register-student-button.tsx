"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import { createStudentFromApplication } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";

export function RegisterStudentButton({
  applicationId,
  basePath,
}: {
  applicationId: string;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createStudentFromApplication(applicationId);
      if (result.ok && result.id) {
        toast.success("Eleven er registrert");
        router.push(`${basePath}/registrerte/${result.id}`);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Registrer som elev"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UserCheck className="size-4" />
      )}
    </Button>
  );
}
