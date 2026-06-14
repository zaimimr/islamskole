import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  as?: ElementType;
  id?: string;
  ariaLabelledby?: string;
};

export function Section({
  children,
  className,
  innerClassName,
  as: Tag = "section",
  id,
  ariaLabelledby,
}: SectionProps) {
  return (
    <Tag
      id={id}
      aria-labelledby={ariaLabelledby}
      className={cn("py-16 sm:py-24", className)}
    >
      <div className={cn("section-shell", innerClassName)}>{children}</div>
    </Tag>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  id?: string;
  align?: "left" | "center";
  tone?: "default" | "light";
};

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  id,
  align = "center",
  tone = "default",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start",
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            "eyebrow",
            tone === "light" &&
              "bg-primary-foreground/15 text-primary-foreground",
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        id={id}
        className={cn(
          "max-w-2xl text-3xl leading-tight font-bold text-balance-pretty sm:text-4xl",
          tone === "light" ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "max-w-2xl text-lg text-balance-pretty",
            tone === "light"
              ? "text-primary-foreground/85"
              : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
