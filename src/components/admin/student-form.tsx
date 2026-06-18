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
  child_first_name: string | null;
  child_last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  mother_phone: string | null;
  mother_email: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
  father_phone: string | null;
  father_email: string | null;
  level_quran: string | null;
  level_arabic: string | null;
  level_islam: string | null;
  notes: string | null;
};

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

const levelOptions = [
  { value: "", label: "Ikke satt" },
  { value: "nybegynner", label: "Nybegynner" },
  { value: "litt", label: "Litt erfaring" },
  { value: "middels", label: "Middels" },
  { value: "god", label: "God" },
];

const genderOptions = [
  { value: "", label: "Ikke satt" },
  { value: "gutt", label: "Gutt" },
  { value: "jente", label: "Jente" },
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
        className={selectClassName}
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
              <Label htmlFor="child_first_name" required>
                Fornavn
              </Label>
              <Input
                id="child_first_name"
                name="child_first_name"
                required
                defaultValue={student?.child_first_name ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="child_last_name" required>
                Etternavn
              </Label>
              <Input
                id="child_last_name"
                name="child_last_name"
                required
                defaultValue={student?.child_last_name ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="birth_date">Fødselsdato</Label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                defaultValue={student?.birth_date ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gender">Kjønn</Label>
              <select
                id="gender"
                name="gender"
                defaultValue={student?.gender ?? ""}
                className={selectClassName}
              >
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              name="address"
              defaultValue={student?.address ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="postal_code">Postnummer</Label>
              <Input
                id="postal_code"
                name="postal_code"
                defaultValue={student?.postal_code ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">Poststed</Label>
              <Input
                id="city"
                name="city"
                defaultValue={student?.city ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">E-post (kontakt)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={student?.email ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon (kontakt)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={student?.phone ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mother_first_name">Fornavn</Label>
              <Input
                id="mother_first_name"
                name="mother_first_name"
                defaultValue={student?.mother_first_name ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mother_last_name">Etternavn</Label>
              <Input
                id="mother_last_name"
                name="mother_last_name"
                defaultValue={student?.mother_last_name ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mother_phone">Telefon</Label>
              <Input
                id="mother_phone"
                name="mother_phone"
                type="tel"
                defaultValue={student?.mother_phone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mother_email">E-post</Label>
              <Input
                id="mother_email"
                name="mother_email"
                type="email"
                defaultValue={student?.mother_email ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Far</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="father_first_name">Fornavn</Label>
              <Input
                id="father_first_name"
                name="father_first_name"
                defaultValue={student?.father_first_name ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="father_last_name">Etternavn</Label>
              <Input
                id="father_last_name"
                name="father_last_name"
                defaultValue={student?.father_last_name ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="father_phone">Telefon</Label>
              <Input
                id="father_phone"
                name="father_phone"
                type="tel"
                defaultValue={student?.father_phone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="father_email">E-post</Label>
              <Input
                id="father_email"
                name="father_email"
                type="email"
                defaultValue={student?.father_email ?? ""}
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
