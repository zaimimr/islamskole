"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SearchIcon } from "lucide-react";
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
  { value: "ikke_betalt", label: "Ikke betalt" },
  { value: "betalt", label: "Betalt" },
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
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="elever-sok">Søk</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="elever-sok"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Navn, foresatt eller e-post"
            className="pl-9"
            onChange={(e) => setParam("q", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Skoleår</Label>
        <Select
          value={searchParams.get("year") ?? "alle"}
          onValueChange={(value) => setParam("year", value ?? "alle")}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string) => yearLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle skoleår</SelectItem>
            <SelectItem value="needs_rollover">Mangler i aktivt skoleår</SelectItem>
            {schoolYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Klasse</Label>
        <Select
          value={searchParams.get("class") ?? "alle"}
          onValueChange={(value) => setParam("class", value ?? "alle")}
        >
          <SelectTrigger className="w-full">
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
        <Label>Betaling</Label>
        <Select
          value={searchParams.get("pay") ?? "alle"}
          onValueChange={(value) => setParam("pay", value ?? "alle")}
        >
          <SelectTrigger className="w-full">
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
