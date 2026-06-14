"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Check, Share2, CalendarPlus } from "lucide-react";

type ShareEventProps = {
  url: string;
  title: string;
  text: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

function toIcsDate(value: string) {
  const date = new Date(value);
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcs({ url, title, text, location, startDate, endDate }: ShareEventProps) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Islamskole Bærum//NO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${url}`,
    startDate ? `DTSTART:${toIcsDate(startDate)}` : "",
    endDate ? `DTEND:${toIcsDate(endDate)}` : "",
    `SUMMARY:${title}`,
    text ? `DESCRIPTION:${text.replace(/\n/g, " ")}` : "",
    location ? `LOCATION:${location}` : "",
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function ShareEvent(props: ShareEventProps) {
  const t = useTranslations("events.share");
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(props.url);
    setCopied(true);
    toast.success(t("copied"));
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: props.title, text: props.text, url: props.url });
      } catch {
        return;
      }
    } else {
      copyLink();
    }
  }

  function addToCalendar() {
    const blob = new Blob([buildIcs(props)], {
      type: "text/calendar;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "islamskole-arrangement.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">{t("inviteNote")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={share} className="btn-pill-primary h-11 px-5 text-sm">
          <Share2 className="size-4" aria-hidden="true" />
          {t("share")}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="btn-pill-outline h-11 px-5 text-sm"
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? t("copied") : t("copy")}
        </button>
        {props.startDate ? (
          <button
            type="button"
            onClick={addToCalendar}
            className="btn-pill-outline h-11 px-5 text-sm"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            {t("calendar")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
