"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statuses = [
  { value: "alle", label: "Alle statuser" },
  { value: "ny", label: "Ny" },
  { value: "kontaktet", label: "Kontaktet" },
  { value: "betaling", label: "Betaling" },
  { value: "akseptert", label: "Akseptert" },
  { value: "arkivert", label: "Arkivert" },
];

export function StudentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "alle") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Søk navn, foresatt eller e-post"
          className="pl-9"
          onChange={(e) => setParam("q", e.target.value)}
        />
      </div>
      <Select
        value={searchParams.get("status") ?? "alle"}
        onValueChange={(value) => setParam("status", value ?? "alle")}
      >
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
