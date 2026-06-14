import type { MetadataRoute } from "next";
import { getPublishedClasses, getPublishedEvents } from "@/lib/data";
import { siteUrl, localePath } from "@/lib/seo";

function entry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${localePath("no", path)}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: {
        no: `${siteUrl}${localePath("no", path)}`,
        en: `${siteUrl}${localePath("en", path)}`,
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [classes, events] = await Promise.all([
    getPublishedClasses(),
    getPublishedEvents(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    entry("/", 1, "weekly"),
    entry("/klasser", 0.9, "monthly"),
    entry("/aktiviteter", 0.9, "weekly"),
    entry("/om-oss", 0.7, "monthly"),
    entry("/kontakt", 0.6, "yearly"),
    entry("/bli-laerer", 0.8, "monthly"),
    entry("/pamelding", 0.9, "monthly"),
  ];

  const classPages = classes.map((c) => entry(`/klasser/${c.slug}`, 0.6, "monthly"));
  const eventPages = events.map((e) => entry(`/aktiviteter/${e.slug}`, 0.6, "weekly"));

  return [...staticPages, ...classPages, ...eventPages];
}
