"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createSchoolYear,
  updateSchoolYear,
} from "@/app/[locale]/admin/school-years-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <form action={handleSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Skoleår</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="label">Navn</Label>
            <Input
              id="label"
              name="label"
              required
              placeholder="2026/2027"
              defaultValue={schoolYear?.label ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
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
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="fee">Semesteravgift (kr)</Label>
            <Input
              id="fee"
              name="fee"
              type="number"
              min="0"
              placeholder="f.eks. 1500"
              defaultValue={schoolYear?.fee ?? ""}
            />
            <p className="text-sm text-muted-foreground">
              Standard skolepenger for dette skoleåret. En klasse med egen pris
              overstyrer dette.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is_active">Aktivt skoleår (standard)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Lagre
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(listHref)}
        >
          Avbryt
        </Button>
      </div>
    </form>
  );
}
