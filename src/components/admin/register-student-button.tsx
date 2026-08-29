"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2, UserCheck } from "lucide-react";
import { createStudentFromApplication } from "@/app/[locale]/admin/students-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Option = { id: string; label: string };

export function RegisterStudentButton({
  applicationId,
  basePath,
  classes,
  schoolYears,
  defaultSchoolYearId,
}: {
  applicationId: string;
  basePath: string;
  classes: { id: string; name: string }[];
  schoolYears: Option[];
  defaultSchoolYearId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [classId, setClassId] = useState("");
  const [schoolYearId, setSchoolYearId] = useState(defaultSchoolYearId ?? "");

  function handleRegister() {
    startTransition(async () => {
      const result = await createStudentFromApplication(applicationId, {
        classId: classId || null,
        schoolYearId: classId ? schoolYearId || null : null,
      });
      if (result.ok && result.id) {
        toast.success("Eleven er registrert");
        router.push(`${basePath}/elever/${result.id}`);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="min-h-10 rounded-xl px-3 font-bold">
            <UserCheck className="size-4" />
            Registrer elev
            <ArrowRight className="size-4" />
          </Button>
        }
      />
      <DialogContent className="rounded-2xl border-[#E3DED3] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrer som elev</DialogTitle>
          <DialogDescription>
            Du kan plassere eleven i en klasse og et skoleår nå, eller gjøre det
            senere fra elevsiden.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 rounded-xl bg-[#F8F6F0] p-4">
          <div className="grid gap-2">
            <Label htmlFor="reg_class">Klasse (valgfritt)</Label>
            <select
              id="reg_class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={`${selectClass} min-h-11 w-full bg-white outline-none focus-visible:border-[#2F7938] focus-visible:ring-3 focus-visible:ring-[#2F7938]/20`}
            >
              <option value="">Ikke plasser ennå</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {classId ? (
            <div className="grid gap-2">
              <Label htmlFor="reg_year">Skoleår</Label>
              <select
                id="reg_year"
                value={schoolYearId}
                onChange={(e) => setSchoolYearId(e.target.value)}
                className={`${selectClass} min-h-11 w-full bg-white outline-none focus-visible:border-[#2F7938] focus-visible:ring-3 focus-visible:ring-[#2F7938]/20`}
              >
                {schoolYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <DialogFooter className="pt-2">
          <Button
            type="button"
            onClick={handleRegister}
            disabled={pending || (Boolean(classId) && !schoolYearId)}
            className="min-h-11 rounded-xl px-5 font-bold"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Registrer elev
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
