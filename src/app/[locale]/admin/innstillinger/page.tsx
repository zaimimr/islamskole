import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import {
  SettingsForm,
  type SettingsRecord,
} from "@/components/admin/settings-form";

async function getSettings(): Promise<SettingsRecord | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select(
        "contact_email, enroll_email, address, hours, facebook_url, instagram_url",
      )
      .maybeSingle();
    return (data as SettingsRecord | null) ?? null;
  } catch {
    return null;
  }
}

export default async function InnstillingerPage() {
  const settings = await getSettings();

  return (
    <div>
      <PageHeader
        title="Innstillinger"
        description="Kontaktinformasjon og lenker."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
