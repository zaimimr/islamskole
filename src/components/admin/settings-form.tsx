"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateSettings } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SettingsRecord = {
  contact_email: string | null;
  enroll_email: string | null;
  address: string | null;
  hours: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

export function SettingsForm({ settings }: { settings: SettingsRecord | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSettings(formData);
      if (result.ok) {
        toast.success("Innstillinger lagret");
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
          <CardTitle>Kontakt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact_email">Kontakt-e-post</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                defaultValue={settings?.contact_email ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="enroll_email">Påmeldings-e-post</Label>
              <Input
                id="enroll_email"
                name="enroll_email"
                type="email"
                defaultValue={settings?.enroll_email ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              name="address"
              defaultValue={settings?.address ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hours">Åpningstider</Label>
            <Textarea
              id="hours"
              name="hours"
              defaultValue={settings?.hours ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sosiale medier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="facebook_url">Facebook-URL</Label>
            <Input
              id="facebook_url"
              name="facebook_url"
              type="url"
              defaultValue={settings?.facebook_url ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instagram_url">Instagram-URL</Label>
            <Input
              id="instagram_url"
              name="instagram_url"
              type="url"
              defaultValue={settings?.instagram_url ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Lagre
        </Button>
      </div>
    </form>
  );
}
