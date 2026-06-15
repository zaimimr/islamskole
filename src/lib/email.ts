import "server-only";
import { Resend } from "resend";

const FROM =
  process.env.RESEND_FROM || "Islamskole Bærum <onboarding@resend.dev>";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Row = [label: string, value: string | null | undefined];

function renderEmail(opts: {
  badge: string;
  title: string;
  intro: string;
  rows: Row[];
  cta?: { label: string; url: string };
}) {
  const cta = opts.cta
    ? `<div style="padding:8px 0 4px;">
          <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:#ff5b24;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:999px;">${escapeHtml(opts.cta.label)}</a>
        </div>`
    : "";
  const rows = opts.rows
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e7eee0;color:#5b6b53;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e7eee0;color:#24331d;font-size:15px;vertical-align:top;white-space:pre-line;">${escapeHtml(String(value))}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="no">
  <body style="margin:0;background:#f3f6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7eee0;">
        <div style="background:#4e9d3f;padding:22px 28px;">
          <div style="display:inline-block;background:#f6c544;color:#3a2e00;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(opts.badge)}</div>
          <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;">${escapeHtml(opts.title)}</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 18px;color:#5b6b53;font-size:15px;">${escapeHtml(opts.intro)}</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e7eee0;border-radius:12px;overflow:hidden;">${rows}</table>
          ${cta}
        </div>
        <div style="padding:16px 28px;background:#f8faf4;color:#7d8a73;font-size:12px;">
          Sendt automatisk fra islamskole.no
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function send(opts: {
  to: string;
  subject: string;
  replyTo?: string | null;
  badge: string;
  title: string;
  intro: string;
  rows: Row[];
  cta?: { label: string; url: string };
}) {
  const resend = getClient();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      replyTo: opts.replyTo ?? undefined,
      html: renderEmail({
        badge: opts.badge,
        title: opts.title,
        intro: opts.intro,
        rows: opts.rows,
        cta: opts.cta,
      }),
    });
  } catch (error) {
    console.error("Resend email failed", error);
  }
}

function formatNok(amountOre: number) {
  return `${(amountOre / 100).toLocaleString("nb-NO")} kr`;
}

export async function sendPaymentLinkEmail(opts: {
  to: string;
  guardianName: string;
  childName: string;
  amount: number;
  term: string | null;
  url: string;
}) {
  await send({
    to: opts.to,
    subject: `Betaling for ${opts.childName}`,
    badge: "Betaling",
    title: "Betaling av skolepenger",
    intro: `Hei ${opts.guardianName}, her er betalingslenken for ${opts.childName}. Trykk på knappen for å betale med Vipps.`,
    cta: { label: "Betal med Vipps", url: opts.url },
    rows: [
      ["Elev", opts.childName],
      ["Termin", opts.term],
      ["Beløp", formatNok(opts.amount)],
    ],
  });
}

export async function sendPaymentReceiptEmail(opts: {
  to: string;
  guardianName: string;
  childName: string;
  amount: number;
  term: string | null;
}) {
  await send({
    to: opts.to,
    subject: `Kvittering - betaling for ${opts.childName}`,
    badge: "Kvittering",
    title: "Betaling mottatt",
    intro: `Hei ${opts.guardianName}, vi har mottatt betalingen for ${opts.childName}. Takk!`,
    rows: [
      ["Elev", opts.childName],
      ["Termin", opts.term],
      ["Beløp betalt", formatNok(opts.amount)],
    ],
  });
}

export async function sendStudentApplicationEmail(opts: {
  to: string;
  childName: string;
  rows: Row[];
  replyTo?: string | null;
}) {
  await send({
    to: opts.to,
    subject: `Ny påmelding: ${opts.childName}`,
    replyTo: opts.replyTo,
    badge: "Påmelding",
    title: "Ny påmelding av elev",
    intro: "En ny elev er meldt på via nettsiden.",
    rows: opts.rows,
  });
}

export async function sendTeacherApplicationEmail(opts: {
  to: string;
  fullName: string;
  rows: Row[];
  replyTo?: string | null;
}) {
  await send({
    to: opts.to,
    subject: `Ny lærersøknad: ${opts.fullName}`,
    replyTo: opts.replyTo,
    badge: "Lærer",
    title: "Ny lærersøknad",
    intro: "Noen ønsker å bli lærer eller frivillig hos Islamskole Bærum.",
    rows: opts.rows,
  });
}
