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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ClassOption = { id: string; name: string };
export type EnrollmentRow = {
  id: string;
  className: string;
  term: string;
  status: string;
};

export function EnrollmentManager({
  studentId,
  classes,
  enrollments,
  defaultTerm,
}: {
  studentId: string;
  classes: ClassOption[];
  enrollments: EnrollmentRow[];
  defaultTerm: string;
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
                  <span className="text-muted-foreground"> · {enrollment.term}</span>
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

        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Opprett en klasse først for å plassere eleven.
          </p>
        ) : (
          <form action={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
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
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="term">Termin</Label>
              <Input
                id="term"
                name="term"
                required
                defaultValue={defaultTerm}
                className="sm:w-40"
              />
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
