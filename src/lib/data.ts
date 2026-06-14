import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import type { Locale } from "@/i18n/routing";

function getReadClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}

export type ClassItem = {
  id: string;
  slug: string;
  name_no: string;
  name_en: string;
  age_min: number | null;
  age_max: number | null;
  capacity: number | null;
  description_no: string | null;
  description_en: string | null;
  curriculum_no: string | null;
  curriculum_en: string | null;
  image_url: string | null;
  sort_order: number;
  published: boolean;
};

export type EventItem = {
  id: string;
  slug: string;
  title_no: string;
  title_en: string;
  excerpt_no: string | null;
  excerpt_en: string | null;
  body_no: string | null;
  body_en: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  image_url: string | null;
  published: boolean;
};

export type InfoBlock = {
  id: string;
  key: string;
  title_no: string | null;
  title_en: string | null;
  body_no: string | null;
  body_en: string | null;
  image_url: string | null;
  sort_order: number;
};

export type SiteSettings = {
  contact_email: string | null;
  enroll_email: string | null;
  address: string | null;
  hours: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

export function localized<T extends Record<string, unknown>>(
  row: T,
  base: string,
  locale: Locale,
): string {
  const value = row[`${base}_${locale}`] ?? row[`${base}_no`];
  return typeof value === "string" ? value : "";
}

function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function getPublishedClasses(): Promise<ClassItem[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getReadClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  return (data as ClassItem[] | null) ?? [];
}

export async function getClassBySlug(slug: string): Promise<ClassItem | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = getReadClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as ClassItem | null) ?? null;
}

export async function getPublishedEvents(): Promise<EventItem[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getReadClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("published", true)
    .order("starts_at", { ascending: true });
  return (data as EventItem[] | null) ?? [];
}

export async function getUpcomingEvents(): Promise<EventItem[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getReadClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("published", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return (data as EventItem[] | null) ?? [];
}

export async function getPastEvents(): Promise<EventItem[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getReadClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("published", true)
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false });
  return (data as EventItem[] | null) ?? [];
}

export async function getEventBySlug(slug: string): Promise<EventItem | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = getReadClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as EventItem | null) ?? null;
}

export async function getInfoBlocks(): Promise<InfoBlock[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = getReadClient();
  const { data } = await supabase
    .from("info_blocks")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data as InfoBlock[] | null) ?? [];
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = getReadClient();
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .maybeSingle();
  return (data as SiteSettings | null) ?? null;
}
