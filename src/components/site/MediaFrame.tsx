import Image from "next/image";
import { cn } from "@/lib/utils";

type MediaFrameProps = {
  src?: string | null;
  alt: string;
  className?: string;
  tone?: "green" | "sky" | "sun" | "berry";
  sizes?: string;
  priority?: boolean;
};

const toneClass: Record<NonNullable<MediaFrameProps["tone"]>, string> = {
  green: "bg-primary/15",
  sky: "bg-accent",
  sun: "bg-secondary",
  berry: "bg-brand-berry/15",
};

export function MediaFrame({
  src,
  alt,
  className,
  tone = "green",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: MediaFrameProps) {
  const hasImage = Boolean(src && src.length > 0);

  return (
    <div
      className={cn("relative overflow-hidden", toneClass[tone], className)}
    >
      {hasImage ? (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover/card:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 via-card to-secondary/40">
          <Image
            src="/brand/logo.png"
            alt=""
            width={160}
            height={65}
            className="w-2/5 max-w-[160px] opacity-25"
          />
        </div>
      )}
    </div>
  );
}
