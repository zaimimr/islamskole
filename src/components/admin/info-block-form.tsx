"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateInfoBlock } from "@/app/[locale]/admin/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export type InfoBlockRecord = {
  id: string;
  key: string | null;
  title_no: string | null;
  title_en: string | null;
  body_no: string | null;
  body_en: string | null;
  image_url: string | null;
  sort_order: number | null;
};

export function InfoBlockForm({ block }: { block: InfoBlockRecord }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateInfoBlock(block.id, formData);
      if (result.ok) {
        toast.success("Innholdsblokk lagret");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm">{block.key}</CardTitle>
        <CardDescription>Innholdsblokk</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`title_no_${block.id}`}>Tittel (norsk)</Label>
              <Input
                id={`title_no_${block.id}`}
                name="title_no"
                defaultValue={block.title_no ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`title_en_${block.id}`}>Tittel (engelsk)</Label>
              <Input
                id={`title_en_${block.id}`}
                name="title_en"
                defaultValue={block.title_en ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`body_no_${block.id}`}>Tekst (norsk)</Label>
              <Textarea
                id={`body_no_${block.id}`}
                name="body_no"
                rows={4}
                defaultValue={block.body_no ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`body_en_${block.id}`}>Tekst (engelsk)</Label>
              <Textarea
                id={`body_en_${block.id}`}
                name="body_en"
                rows={4}
                defaultValue={block.body_en ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor={`sort_order_${block.id}`}>Rekkefølge</Label>
            <Input
              id={`sort_order_${block.id}`}
              name="sort_order"
              type="number"
              defaultValue={block.sort_order ?? 0}
            />
          </div>
          <ImageUpload
            name="image_url"
            label="Bilde"
            defaultValue={block.image_url}
          />
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Lagre
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
