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
          <Label htmlFor="child_age">{t("fieldChildAge")}</Label>
          <Input
            id="child_age"
            name="child_age"
            type="number"
            min={4}
            max={20}
            placeholder={t("placeholderChildAge")}
          />
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
