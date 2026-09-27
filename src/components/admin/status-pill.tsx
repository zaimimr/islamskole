import { cn } from "@/lib/utils";

export type StatusTone =
  "ok" | "info" | "pending" | "warn" | "danger" | "neutral";

const toneClasses: Record<StatusTone, { pill: string; dot: string }> = {
  ok: { pill: "bg-[#DCEDDD] text-[#216A2B]", dot: "bg-[#3C8F44]" },
  info: { pill: "bg-[#E4F1FA] text-[#245D7C]", dot: "bg-[#3B82B5]" },
  pending: { pill: "bg-[#FEF3D7] text-[#6B4A06]", dot: "bg-[#C98A0B]" },
  warn: { pill: "bg-[#FEEDCA] text-[#775108]", dot: "bg-[#D08A00]" },
  danger: { pill: "bg-[#F9DEDB] text-[#8B2F2B]", dot: "bg-[#C2413B]" },
  neutral: { pill: "bg-[#F0F0ED] text-[#4E5550]", dot: "bg-[#7A827C]" },
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const classes = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        classes.pill,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", classes.dot)}
      />
      {children}
    </span>
  );
}
