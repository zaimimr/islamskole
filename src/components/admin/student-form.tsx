"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createStudent,
  updateStudent,
} from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StudentRecord = {
  id: string;
  full_name: string | null;
  child_age: number | null;
  guardian_name: string | null;
  email: string | null;
  phone: string | null;
  guardian2_name: string | null;
  guardian2_email: string | null;
  guardian2_phone: string | null;
  student_email: string | null;
  student_phone: string | null;
  level_quran: string | null;
  level_arabic: string | null;
  level_islam: string | null;
  notes: string | null;
};

const levelOptions = [
  { value: "", label: "Ikke satt" },
  { value: "nybegynner", label: "Nybegynner" },
  { value: "litt", label: "Litt erfaring" },
  { value: "middels", label: "Middels" },
  { value: "god", label: "God" },
];

function LevelSelect({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
      >
        {levelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StudentForm({
  student,
  listHref,
}: {
  student?: StudentRecord;
  listHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = student
        ? await updateStudent(student.id, formData)
        : await createStudent(formData);
      if (result.ok) {
        toast.success(student ? "Elev oppdatert" : "Elev registrert");
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
          <CardTitle>Elev</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Navn</Label>
              <Input
                id="full_name"
                name="full_name"
                required
                defaultValue={student?.full_name ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="child_age">Alder</Label>
              <Input
                id="child_age"
                name="child_age"
                type="number"
                defaultValue={student?.child_age ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Foresatt 1</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="guardian_name">Navn</Label>
            <Input
              id="guardian_name"
              name="guardian_name"
              required
              defaultValue={student?.guardian_name ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={student?.email ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={student?.phone ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Foresatt 2 (valgfritt)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="guardian2_name">Navn</Label>
            <Input
              id="guardian2_name"
              name="guardian2_name"
              defaultValue={student?.guardian2_name ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="guardian2_email">E-post</Label>
              <Input
                id="guardian2_email"
                name="guardian2_email"
                type="email"
                defaultValue={student?.guardian2_email ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guardian2_phone">Telefon</Label>
              <Input
                id="guardian2_phone"
                name="guardian2_phone"
                defaultValue={student?.guardian2_phone ?? ""}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Betalingslenken sendes til e-posten til begge foresatte. Når én har
            betalt, ser den andre kvitteringssiden.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elevens kontakt (valgfritt)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="student_email">E-post</Label>
            <Input
              id="student_email"
              name="student_email"
              type="email"
              defaultValue={student?.student_email ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="student_phone">Telefon</Label>
            <Input
              id="student_phone"
              name="student_phone"
              defaultValue={student?.student_phone ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nivå og notater</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <LevelSelect
              name="level_quran"
              label="Koran"
              defaultValue={student?.level_quran ?? null}
            />
            <LevelSelect
              name="level_arabic"
              label="Arabisk"
              defaultValue={student?.level_arabic ?? null}
            />
            <LevelSelect
              name="level_islam"
              label="Islam"
              defaultValue={student?.level_islam ?? null}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notater</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={student?.notes ?? ""}
            />
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
