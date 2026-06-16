"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  placeStudentInClass,
  removeEnrollment,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ClassOption = { id: string; name: string; price: number | null };
export type SchoolYearOption = { id: string; label: string };
export type EnrollmentRow = {
  id: string;
  className: string;
  schoolYear: string;
  status: string;
  price: number | null;
};

function priceLabel(price: number | null) {
  return price != null ? `${price.toLocaleString("nb-NO")} kr/termin` : null;
}

export function EnrollmentManager({
  studentId,
  classes,
  schoolYears,
  enrollments,
  defaultSchoolYearId,
}: {
  studentId: string;
  classes: ClassOption[];
  schoolYears: SchoolYearOption[];
  enrollments: EnrollmentRow[];
  defaultSchoolYearId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("student_id", studentId);
    startTransition(async () => {
      const result = await placeStudentInClass(formData);
      if (result.ok) {
        toast.success("Eleven er plassert i klassen");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeEnrollment(id);
      if (result.ok) {
        toast.success("Plassering fjernet");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const canPlace = classes.length > 0 && schoolYears.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Klasseplassering</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {enrollments.length > 0 ? (
          <ul className="grid gap-2">
            {enrollments.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{enrollment.className}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {enrollment.schoolYear}
                  </span>
                  {priceLabel(enrollment.price) ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {priceLabel(enrollment.price)}
                    </span>
                  ) : null}
                  {enrollment.status !== "aktiv" ? (
                    <Badge variant="secondary" className="ml-2">
                      {enrollment.status}
                    </Badge>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Fjern plassering"
                  disabled={pending}
                  onClick={() => handleRemove(enrollment.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Eleven er ikke plassert i noen klasse ennå.
          </p>
        )}

        {!canPlace ? (
          <p className="text-sm text-muted-foreground">
            Opprett en klasse og et skoleår først for å plassere eleven.
          </p>
        ) : (
          <form
            action={handleSubmit}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="grid gap-2">
              <Label htmlFor="class_id">Klasse</Label>
              <select
                id="class_id"
                name="class_id"
                required
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {classes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {priceLabel(option.price)
                      ? ` (${priceLabel(option.price)})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="school_year_id">Skoleår</Label>
              <select
                id="school_year_id"
                name="school_year_id"
                required
                defaultValue={defaultSchoolYearId ?? ""}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              >
                {schoolYears.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Plasser
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
