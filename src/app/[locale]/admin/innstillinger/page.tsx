import { createClient } from "@/lib/supabase/server";
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
    <div className="grid gap-6 lg:gap-7">
      <header>
        <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          Innstillinger
        </h1>
        <p className="mt-1 max-w-2xl text-admin-muted">
          Kontaktinformasjon og offentlige lenker som brukes på nettsiden.
        </p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
