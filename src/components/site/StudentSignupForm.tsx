"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, PartyPopper } from "lucide-react";
import { createStudentApplication } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StudentSignupForm() {
  const t = useTranslations("enrollForm");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createStudentApplication(formData);
      if (result.ok) {
        toast.success(t("toastSuccess"));
        setDone(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-primary/8 px-6 py-12 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/15 text-brand-green-dark">
          <PartyPopper className="size-7" aria-hidden="true" />
        </span>
        <h3 className="font-heading text-2xl font-bold">{t("thanksTitle")}</h3>
        <p className="max-w-md text-base text-muted-foreground">
          {t("thanksBody")}
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="child_name">{t("fieldChildName")}</Label>
          <Input
            id="child_name"
            name="child_name"
            required
            placeholder={t("placeholderChildName")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="birth_date">{t("fieldChildBirthDate")}</Label>
          <Input id="birth_date" name="birth_date" type="date" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="guardian_name">{t("fieldGuardian")}</Label>
        <Input
          id="guardian_name"
          name="guardian_name"
          required
          autoComplete="name"
          placeholder={t("placeholderGuardian")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("fieldEmail")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("placeholderEmail")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">{t("fieldPhone")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t("placeholderPhone")}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="desired_class">{t("fieldDesiredClass")}</Label>
        <Input
          id="desired_class"
          name="desired_class"
          placeholder={t("placeholderDesiredClass")}
        />
      </div>

      <div className="grid gap-3 rounded-2xl bg-muted/40 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("levelsTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t("levelsHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["level_quran", "levelQuran"],
              ["level_arabic", "levelArabic"],
              ["level_islam", "levelIslam"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="grid gap-2">
              <Label htmlFor={name}>{t(label)}</Label>
              <select
                id={name}
                name={name}
                defaultValue=""
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">{t("levelPlaceholder")}</option>
                {(["nybegynner", "litt", "middels", "god"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`levels.${v}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="message">{t("fieldMessage")}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder={t("placeholderMessage")}
        />
      </div>

      <Button type="submit" disabled={pending} className="h-12 w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
