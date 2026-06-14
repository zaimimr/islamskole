"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createEvent, updateEvent } from "@/app/[locale]/admin/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type EventRecord = {
  id: string;
  slug: string | null;
  title_no: string | null;
  title_en: string | null;
  excerpt_no: string | null;
  excerpt_en: string | null;
  body_no: string | null;
  body_en: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  image_url: string | null;
  published: boolean | null;
};

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EventForm({
  event,
  listHref,
}: {
  event?: EventRecord;
  listHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState(event?.published ?? false);

  function handleSubmit(formData: FormData) {
    formData.set("published", published ? "true" : "false");
    startTransition(async () => {
      const result = event
        ? await updateEvent(event.id, formData)
        : await createEvent(formData);
      if (result.ok) {
        toast.success(event ? "Aktivitet oppdatert" : "Aktivitet opprettet");
        router.push(listHref);
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
          <CardTitle>Norsk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title_no">Tittel</Label>
            <Input
              id="title_no"
              name="title_no"
              required
              defaultValue={event?.title_no ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="excerpt_no">Ingress</Label>
            <Textarea
              id="excerpt_no"
              name="excerpt_no"
              defaultValue={event?.excerpt_no ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body_no">Brødtekst</Label>
            <Textarea
              id="body_no"
              name="body_no"
              rows={6}
              defaultValue={event?.body_no ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engelsk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title_en">Tittel</Label>
            <Input
              id="title_en"
              name="title_en"
              defaultValue={event?.title_en ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="excerpt_en">Ingress</Label>
            <Textarea
              id="excerpt_en"
              name="excerpt_en"
              defaultValue={event?.excerpt_en ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body_en">Brødtekst</Label>
            <Textarea
              id="body_en"
              name="body_en"
              rows={6}
              defaultValue={event?.body_en ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detaljer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="starts_at">Starttidspunkt</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={toLocalInput(event?.starts_at ?? null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ends_at">Sluttidspunkt</Label>
              <Input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                defaultValue={toLocalInput(event?.ends_at ?? null)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Sted</Label>
            <Input
              id="location"
              name="location"
              defaultValue={event?.location ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="Genereres automatisk fra tittel"
              defaultValue={event?.slug ?? ""}
            />
          </div>
          <ImageUpload name="image_url" defaultValue={event?.image_url} />
          <div className="flex items-center gap-3">
            <Switch
              id="published"
              checked={published}
              onCheckedChange={setPublished}
            />
            <Label htmlFor="published">Publisert</Label>
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
