import "server-only";
import { Resend } from "resend";

const FROM =
  process.env.RESEND_FROM || "Islamskole Bærum <onboarding@resend.dev>";

export type EmailLang = "no" | "en";

const STRINGS = {
  no: {
    footer: "Sendt automatisk fra islamskole.no",
    rows: {
      student: "Elev",
      class: "Klasse",
      schoolYear: "Skoleår",
      amount: "Beløp",
      amountPaid: "Beløp betalt",
      dueDate: "Betalingsfrist",
    },
    paymentLink: {
      subject: (child: string) => `Betaling for ${child}`,
      badge: "Betaling",
      title: "Betaling av skolepenger",
      intro: (child: string) =>
        `Hei, her er betalingslenken for ${child}. Trykk på knappen for å betale med Vipps.`,
      cta: "Betal med Vipps",
    },
    installment: {
      subject: (dueDate: string) => `Betalingsfrist ${dueDate} - skoleavgift`,
      badge: "Avdrag",
      title: "Avdrag på skoleavgiften",
      intro: (children: string) =>
        `Hei, her er betalingslenken for neste avdrag på skoleavgiften for ${children}. Trykk på knappen for å betale med Vipps.`,
      cta: "Betal med Vipps",
      totalLabel: "Totalt å betale",
    },
    receipt: {
      subject: (child: string) => `Kvittering - betaling for ${child}`,
      badge: "Kvittering",
      title: "Betaling mottatt",
      intro: (child: string) =>
        `Hei, vi har mottatt betalingen for ${child}. Takk!`,
      enrollmentNote:
        "Dette er første del av skoleavgiften. Resten betales innen 15. august og 15. desember, eller månedlig etter avtale. Dere får betalingslenke på e-post.",
    },
    studentConfirmation: {
      subject: "Vi har mottatt påmeldingen",
      badge: "Påmelding",
      title: "Takk for påmeldingen",
      intro: (child: string) =>
        `Hei, vi har mottatt påmeldingen for ${child}. Vi tar kontakt så snart vi har gått gjennom den.`,
    },
    teacherConfirmation: {
      subject: "Vi har mottatt søknaden din",
      badge: "Lærer",
      title: "Takk for søknaden",
      intro: (name: string) =>
        `Hei ${name}, takk for interessen. Vi tar kontakt så snart vi har gått gjennom søknaden din.`,
    },
  },
  en: {
    footer: "Sent automatically from islamskole.no",
    rows: {
      student: "Student",
      class: "Class",
      schoolYear: "School year",
      amount: "Amount",
      amountPaid: "Amount paid",
      dueDate: "Payment deadline",
    },
    paymentLink: {
      subject: (child: string) => `Payment for ${child}`,
      badge: "Payment",
      title: "School fee payment",
      intro: (child: string) =>
        `Hi, here is the payment link for ${child}. Tap the button to pay with Vipps.`,
      cta: "Pay with Vipps",
    },
    installment: {
      subject: (dueDate: string) => `Payment due ${dueDate} - school fee`,
      badge: "Installment",
      title: "School fee installment",
      intro: (children: string) =>
        `Hi, here is the payment link for the next school fee installment for ${children}. Tap the button to pay with Vipps.`,
      cta: "Pay with Vipps",
      totalLabel: "Total to pay",
    },
    receipt: {
      subject: (child: string) => `Receipt - payment for ${child}`,
      badge: "Receipt",
      title: "Payment received",
      intro: (child: string) =>
        `Hi, we have received the payment for ${child}. Thank you!`,
      enrollmentNote:
        "This is the first part of the school fee. The remainder is due by 15 August and 15 December, or monthly by agreement. Payment links are sent by email.",
    },
    studentConfirmation: {
      subject: "We have received your registration",
      badge: "Registration",
      title: "Thank you for registering",
      intro: (child: string) =>
        `Hi, we have received the registration for ${child}. We will be in touch once we have reviewed it.`,
    },
    teacherConfirmation: {
      subject: "We have received your application",
      badge: "Teacher",
      title: "Thank you for applying",
      intro: (name: string) =>
        `Hi ${name}, thank you for your interest. We will be in touch once we have reviewed your application.`,
    },
  },
} as const;

function strings(lang: EmailLang) {
  return STRINGS[lang] ?? STRINGS.no;
}

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
  lang: EmailLang;
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
<html lang="${opts.lang}">
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
          ${escapeHtml(strings(opts.lang).footer)}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function send(opts: {
  lang: EmailLang;
  to: string | string[];
  subject: string;
  replyTo?: string | null;
  badge: string;
  title: string;
  intro: string;
  rows: Row[];
  cta?: { label: string; url: string };
}) {
  const resend = getClient();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      replyTo: opts.replyTo ?? undefined,
      html: renderEmail({
        lang: opts.lang,
        badge: opts.badge,
        title: opts.title,
        intro: opts.intro,
        rows: opts.rows,
        cta: opts.cta,
      }),
    });
    if (error) {
      console.error("Resend email failed", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend email failed", error);
    return false;
  }
}

function formatNok(amountOre: number) {
  return `${(amountOre / 100).toLocaleString("nb-NO")} kr`;
}

function formatDueDate(value: string | null | undefined, lang: EmailLang) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

export async function sendPaymentLinkEmail(opts: {
  to: string | string[];
  guardianName: string;
  childName: string;
  amount: number;
  schoolYear: string | null;
  className: string | null;
  dueDate?: string | null;
  url: string;
  lang?: EmailLang;
}): Promise<boolean> {
  const lang = opts.lang ?? "no";
  const t = strings(lang);
  return await send({
    lang,
    to: opts.to,
    subject: t.paymentLink.subject(opts.childName),
    badge: t.paymentLink.badge,
    title: t.paymentLink.title,
    intro: t.paymentLink.intro(opts.childName),
    cta: { label: t.paymentLink.cta, url: opts.url },
    rows: [
      [t.rows.student, opts.childName],
      [t.rows.class, opts.className],
      [t.rows.schoolYear, opts.schoolYear],
      [t.rows.amount, formatNok(opts.amount)],
      [t.rows.dueDate, formatDueDate(opts.dueDate, lang)],
    ],
  });
}

export async function sendInstallmentEmail(opts: {
  to: string | string[];
  children: { name: string; amount: number }[];
  totalAmount: number;
  schoolYear: string | null;
  dueDate: string;
  url: string;
  lang?: EmailLang;
}): Promise<boolean> {
  const lang = opts.lang ?? "no";
  const t = strings(lang);
  const dueLabel = formatDueDate(opts.dueDate, lang) ?? opts.dueDate;
  const childNames = opts.children.map((child) => child.name).join(", ");
  return await send({
    lang,
    to: opts.to,
    subject: t.installment.subject(dueLabel),
    badge: t.installment.badge,
    title: t.installment.title,
    intro: t.installment.intro(childNames),
    cta: { label: t.installment.cta, url: opts.url },
    rows: [
      ...opts.children.map(
        (child): Row => [child.name, formatNok(child.amount)],
      ),
      [t.installment.totalLabel, formatNok(opts.totalAmount)],
      [t.rows.schoolYear, opts.schoolYear],
      [t.rows.dueDate, dueLabel],
    ],
  });
}

export async function sendPaymentReceiptEmail(opts: {
  to: string | string[];
  guardianName: string;
  childName: string;
  amount: number;
  schoolYear: string | null;
  className: string | null;
  enrollmentDeposit?: boolean;
  lang?: EmailLang;
}) {
  const lang = opts.lang ?? "no";
  const t = strings(lang);
  await send({
    lang,
    to: opts.to,
    subject: t.receipt.subject(opts.childName),
    badge: t.receipt.badge,
    title: t.receipt.title,
    intro: opts.enrollmentDeposit
      ? `${t.receipt.intro(opts.childName)} ${t.receipt.enrollmentNote}`
      : t.receipt.intro(opts.childName),
    rows: [
      [t.rows.student, opts.childName],
      [t.rows.class, opts.className],
      [t.rows.schoolYear, opts.schoolYear],
      [t.rows.amountPaid, formatNok(opts.amount)],
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
    lang: "no",
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
    lang: "no",
    to: opts.to,
    subject: `Ny lærersøknad: ${opts.fullName}`,
    replyTo: opts.replyTo,
    badge: "Lærer",
    title: "Ny lærersøknad",
    intro: "Noen ønsker å bli lærer eller frivillig hos Islamskole Bærum.",
    rows: opts.rows,
  });
}

export async function sendStudentApplicationConfirmationEmail(opts: {
  to: string;
  childName: string;
  rows?: Row[];
  lang?: EmailLang;
}) {
  const lang = opts.lang ?? "no";
  const t = strings(lang);
  await send({
    lang,
    to: opts.to,
    subject: t.studentConfirmation.subject,
    badge: t.studentConfirmation.badge,
    title: t.studentConfirmation.title,
    intro: t.studentConfirmation.intro(opts.childName),
    rows: opts.rows ?? [],
  });
}

export async function sendTeacherApplicationConfirmationEmail(opts: {
  to: string;
  fullName: string;
  lang?: EmailLang;
}) {
  const lang = opts.lang ?? "no";
  const t = strings(lang);
  await send({
    lang,
    to: opts.to,
    subject: t.teacherConfirmation.subject,
    badge: t.teacherConfirmation.badge,
    title: t.teacherConfirmation.title,
    intro: t.teacherConfirmation.intro(opts.fullName),
    rows: [],
  });
}
