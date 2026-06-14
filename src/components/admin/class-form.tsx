"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClass, updateClass } from "@/app/[locale]/admin/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ClassRecord = {
  id: string;
  slug: string | null;
  name_no: string | null;
  name_en: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number | null;
  description_no: string | null;
  description_en: string | null;
  curriculum_no: string | null;
  curriculum_en: string | null;
  image_url: string | null;
  sort_order: number | null;
  published: boolean | null;
};

export function ClassForm({
  classRecord,
  listHref,
}: {
  classRecord?: ClassRecord;
  listHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState(classRecord?.published ?? false);

  function handleSubmit(formData: FormData) {
    formData.set("published", published ? "true" : "false");
    startTransition(async () => {
      const result = classRecord
        ? await updateClass(classRecord.id, formData)
        : await createClass(formData);
      if (result.ok) {
        toast.success(classRecord ? "Klasse oppdatert" : "Klasse opprettet");
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
            <Label htmlFor="name_no">Navn</Label>
            <Input
              id="name_no"
              name="name_no"
              required
              defaultValue={classRecord?.name_no ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description_no">Beskrivelse</Label>
            <Textarea
              id="description_no"
              name="description_no"
              defaultValue={classRecord?.description_no ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="curriculum_no">Læreplan</Label>
            <Textarea
              id="curriculum_no"
              name="curriculum_no"
              rows={5}
              defaultValue={classRecord?.curriculum_no ?? ""}
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
            <Label htmlFor="name_en">Navn</Label>
            <Input
              id="name_en"
              name="name_en"
              defaultValue={classRecord?.name_en ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description_en">Beskrivelse</Label>
            <Textarea
              id="description_en"
              name="description_en"
              defaultValue={classRecord?.description_en ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="curriculum_en">Læreplan</Label>
            <Textarea
              id="curriculum_en"
              name="curriculum_en"
              rows={5}
              defaultValue={classRecord?.curriculum_en ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detaljer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="age_min">Alder fra</Label>
              <Input
                id="age_min"
                name="age_min"
                type="number"
                defaultValue={classRecord?.age_min ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="age_max">Alder til</Label>
              <Input
                id="age_max"
                name="age_max"
                type="number"
                defaultValue={classRecord?.age_max ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Kapasitet</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                defaultValue={classRecord?.capacity ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sort_order">Rekkefølge</Label>
              <Input
                id="sort_order"
                name="sort_order"
                type="number"
                defaultValue={classRecord?.sort_order ?? 0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="Genereres automatisk fra navn"
                defaultValue={classRecord?.slug ?? ""}
              />
            </div>
          </div>
          <ImageUpload name="image_url" defaultValue={classRecord?.image_url} />
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
