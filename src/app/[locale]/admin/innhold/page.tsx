import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import {
  InfoBlockForm,
  type InfoBlockRecord,
} from "@/components/admin/info-block-form";
import { Card, CardContent } from "@/components/ui/card";

async function getInfoBlocks(): Promise<InfoBlockRecord[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("info_blocks")
      .select("*")
      .order("sort_order", { ascending: true });
    return (data as InfoBlockRecord[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function InnholdPage() {
  const blocks = await getInfoBlocks();

  return (
    <div>
      <PageHeader title="Innhold" description="Rediger innholdsblokker." />

      {blocks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ingen innholdsblokker funnet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {blocks.map((block) => (
            <InfoBlockForm key={block.id} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
