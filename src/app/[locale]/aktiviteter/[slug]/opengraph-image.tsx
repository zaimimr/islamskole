import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getEventBySlug, localized } from "@/lib/data";
import { formatEventDate } from "@/components/site/format";
import type { Locale } from "@/i18n/routing";

export const alt = "Arrangement - Islamskole Bærum";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const typedLocale = locale as Locale;
  const event = await getEventBySlug(slug);

  const logo = await readFile(
    join(process.cwd(), "public/brand/logo-white.png"),
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  const title = event ? localized(event, "title", typedLocale) : "Arrangement";
  const dateLabel = event
    ? formatEventDate(event.starts_at, typedLocale)
    : null;
  const image = event?.image_url ?? null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#4e9d3f",
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(180deg, rgba(20,50,25,0.15) 0%, rgba(20,50,25,0.35) 45%, rgba(20,50,25,0.85) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          padding: 72,
          gap: 18,
        }}
      >
        {dateLabel ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              backgroundColor: "#f6c544",
              color: "#3a2e00",
              fontSize: 30,
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: 999,
            }}
          >
            {dateLabel}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <img src={logoSrc} width={300} alt="" style={{ marginTop: 8 }} />
      </div>
    </div>,
    { ...size },
  );
}
