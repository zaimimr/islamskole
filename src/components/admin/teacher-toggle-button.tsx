"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { GraduationCap, Loader2, UserMinus } from "lucide-react";
import {
  registerTeacher,
  removeTeacher,
} from "@/app/[locale]/admin/familier/families-actions";
import { cn } from "@/lib/utils";

export function TeacherToggleButton({
  guardianId,
  name,
  isTeacher,
  className,
}: {
  guardianId: string;
  name: string;
  isTeacher: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      let result;
      if (isTeacher) {
        result = await removeTeacher(guardianId);
      } else {
        const formData = new FormData();
        formData.set("guardian_id", guardianId);
        result = await registerTeacher(formData);
      }
      if (result.ok) {
        toast.success(
          isTeacher ? `${name} er ikke lenger lærer` : `${name} er nå registrert som lærer`,
          isTeacher
            ? undefined
            : { description: "Knytt læreren til en klasse under Klasser." },
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  const Icon = pending ? Loader2 : isTeacher ? UserMinus : GraduationCap;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 xl:min-h-8",
        isTeacher ? "text-admin-muted" : "text-[#277A31]",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", pending && "animate-spin")}
      />
      {isTeacher ? "Fjern som lærer" : "Gjør til lærer"}
    </button>
  );
}
