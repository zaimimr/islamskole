"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange, CircleAlert, Loader2, Wallet } from "lucide-react";
import {
  createSchoolYear,
  updateSchoolYear,
} from "@/app/[locale]/admin/school-years-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type SchoolYearRecord = {
  id: string;
  label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  fee: number | null;
  is_active: boolean | null;
};

export function SchoolYearForm({
  schoolYear,
  listHref,
}: {
  schoolYear?: SchoolYearRecord;
  listHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(schoolYear?.is_active ?? false);

  function handleSubmit(formData: FormData) {
    formData.set("is_active", isActive ? "true" : "false");
    startTransition(async () => {
      const result = schoolYear
        ? await updateSchoolYear(schoolYear.id, formData)
        : await createSchoolYear(formData);
      if (result.ok) {
        toast.success(schoolYear ? "Skoleår oppdatert" : "Skoleår opprettet");
        router.push(result.id ? `${listHref}/${result.id}` : listHref);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-5">
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
        <div className="border-b border-[#ECE8DF] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <CalendarRange aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-bold">
                Innstillinger for skoleåret
              </h2>
              <p className="mt-0.5 text-sm text-admin-muted">
                Perioden og avgiften brukes i plassering og betalingsoversikt.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.7fr)]">
          <div className="grid content-start gap-5">
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="label" required>
                Navn
              </Label>
              <Input
                id="label"
                name="label"
                required
                autoComplete="off"
                placeholder="2026/2027"
                defaultValue={schoolYear?.label ?? ""}
              />
              <p className="text-sm text-admin-muted">
                Bruk et tydelig navn som 2026/2027.
              </p>
            </div>
            <div className="grid gap-4 sm:max-w-xl sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="starts_on">Starter</Label>
                <Input
                  id="starts_on"
                  name="starts_on"
                  type="date"
                  defaultValue={schoolYear?.starts_on ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ends_on">Slutter</Label>
                <Input
                  id="ends_on"
                  name="ends_on"
                  type="date"
                  defaultValue={schoolYear?.ends_on ?? ""}
                />
              </div>
            </div>
          </div>

          <div className="grid content-start gap-5 rounded-xl bg-[#F7F6F1] p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
                <Wallet aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Label htmlFor="fee">Semesteravgift (kr)</Label>
                <Input
                  id="fee"
                  name="fee"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="For eksempel 1500"
                  defaultValue={schoolYear?.fee ?? ""}
                  className="mt-2 bg-white"
                />
                <p className="mt-2 text-sm text-admin-muted">
                  En klasse med egen pris overstyrer denne standardavgiften.
                </p>
              </div>
            </div>

            <div className="border-t border-[#E2DED4] pt-4">
              <div className="flex min-h-14 items-center justify-between gap-4">
                <div>
                  <Label htmlFor="is_active" className="font-bold">
                    Aktivt skoleår
                  </Label>
                  <p className="mt-0.5 text-xs text-admin-muted">
                    Brukes som standard i administrasjonen.
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
              {isActive ? (
                <p className="mt-3 flex gap-2 rounded-lg bg-[#FFF8E9] p-3 text-xs text-[#6D5A2D]">
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  Dette året blir standard for nye plasseringer og betalinger.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(listHref)}
          className="min-h-11"
        >
          Avbryt
        </Button>
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {schoolYear ? "Lagre endringer" : "Opprett skoleår"}
        </Button>
      </div>
    </form>
  );
}
