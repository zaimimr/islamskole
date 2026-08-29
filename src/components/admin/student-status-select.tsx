"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateStudentApplicationStatus } from "@/app/[locale]/admin/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusOptions = [
  { value: "ny", label: "Ny" },
  { value: "kontaktet", label: "Kontaktet" },
  { value: "akseptert", label: "Akseptert" },
  { value: "avslatt", label: "Avslått" },
  { value: "arkivert", label: "Arkivert" },
];

const statusClassName: Record<string, string> = {
  ny: "border-[#E7CA91] bg-[#FFF8E9] text-[#775108]",
  kontaktet: "border-[#BBD8EA] bg-[#EFF8FD] text-[#245D7C]",
  akseptert: "border-[#B7D7BA] bg-[#F0F8F1] text-[#216A2B]",
  avslatt: "border-[#E7B8B4] bg-[#FFF2F1] text-[#9A3028]",
  arkivert: "border-[#D8D3C8] bg-[#F2F1EB] text-[#5C5B55]",
};

export function StudentStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(next: string | null) {
    if (!next || next === status) return;
    startTransition(async () => {
      const result = await updateStudentApplicationStatus(id, next);
      if (result.ok) {
        toast.success("Status oppdatert");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger
        size="sm"
        className={`min-h-10 w-36 rounded-xl font-bold shadow-none ${statusClassName[status] ?? statusClassName.arkivert}`}
        aria-label="Søknadsstatus"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
