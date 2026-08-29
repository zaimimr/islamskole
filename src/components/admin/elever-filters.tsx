"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, CreditCard, SearchIcon, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const paymentStatuses = [
  { value: "alle", label: "All betaling" },
  { value: "ikke_betalt", label: "Ikke ferdig betalt" },
  { value: "betalt", label: "Betalt" },
  { value: "delvis", label: "Delvis betalt" },
  { value: "venter", label: "Lenke sendt, venter" },
  { value: "ubetalt", label: "Ingen lenke sendt" },
];

export function EleverFilters({
  classes,
  schoolYears,
}: {
  classes: { id: string; name: string }[];
  schoolYears: { id: string; label: string }[];
}) {
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

  const yearLabel = (v: string) =>
    v === "alle"
      ? "Alle skoleår"
      : v === "needs_rollover"
        ? "Mangler i aktivt skoleår"
        : (schoolYears.find((y) => y.id === v)?.label ?? "Alle skoleår");
  const classLabel = (v: string) =>
    v === "alle"
      ? "Alle klasser"
      : (classes.find((c) => c.id === v)?.name ?? "Alle klasser");
  const payLabel = (v: string) =>
    paymentStatuses.find((s) => s.value === v)?.label ?? "All betaling";

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end"
      aria-busy={pending}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="elever-sok">Søk</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#2F7938]" />
          <Input
            id="elever-sok"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Navn, foresatt eller e-post"
            className="min-h-11 rounded-xl border-[#CFC9BD] bg-white pl-10 shadow-none focus-visible:border-[#2F7938] focus-visible:ring-[#2F7938]/20"
            onChange={(e) => setParam("q", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="elever-school-year">Skoleår</Label>
        <Select
          value={searchParams.get("year") ?? "alle"}
          onValueChange={(value) => setParam("year", value ?? "alle")}
        >
          <SelectTrigger
            id="elever-school-year"
            className="min-h-11 w-full rounded-xl border-[#CFC9BD] bg-white shadow-none"
          >
            <CalendarDays className="size-4 text-[#2F7938]" />
            <SelectValue>{(v: string) => yearLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle skoleår</SelectItem>
            <SelectItem value="needs_rollover">
              Mangler i aktivt skoleår
            </SelectItem>
            {schoolYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="elever-class">Klasse</Label>
        <Select
          value={searchParams.get("class") ?? "alle"}
          onValueChange={(value) => setParam("class", value ?? "alle")}
        >
          <SelectTrigger
            id="elever-class"
            className="min-h-11 w-full rounded-xl border-[#CFC9BD] bg-white shadow-none"
          >
            <UsersRound className="size-4 text-[#2F7938]" />
            <SelectValue>{(v: string) => classLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle klasser</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="elever-payment">Betaling</Label>
        <Select
          value={searchParams.get("pay") ?? "alle"}
          onValueChange={(value) => setParam("pay", value ?? "alle")}
        >
          <SelectTrigger
            id="elever-payment"
            className="min-h-11 w-full rounded-xl border-[#CFC9BD] bg-white shadow-none"
          >
            <CreditCard className="size-4 text-[#2F7938]" />
            <SelectValue>{(v: string) => payLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {paymentStatuses.map((s) => (
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
