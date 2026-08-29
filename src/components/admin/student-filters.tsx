"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ListFilter, SearchIcon } from "lucide-react";
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
  { value: "akseptert", label: "Akseptert" },
  { value: "avslatt", label: "Avslått" },
  { value: "arkivert", label: "Arkivert" },
];

export function StudentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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
    <div
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]"
      aria-busy={pending}
    >
      <div className="grid gap-1.5">
        <label htmlFor="application-search" className="text-sm font-bold">
          Søk i innmeldinger
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#2F7938]" />
          <Input
            id="application-search"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Søk navn, foresatt eller e-post"
            className="min-h-11 rounded-xl border-[#CFC9BD] bg-white pl-10 shadow-none focus-visible:border-[#2F7938] focus-visible:ring-[#2F7938]/20"
            onChange={(e) => setParam("q", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-bold">Vis status</span>
        <Select
          value={searchParams.get("status") ?? "alle"}
          onValueChange={(value) => setParam("status", value ?? "alle")}
        >
          <SelectTrigger
            aria-label="Vis status"
            className="min-h-11 w-full rounded-xl border-[#CFC9BD] bg-white shadow-none"
          >
            <ListFilter className="size-4 text-[#2F7938]" />
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
    </div>
  );
}
