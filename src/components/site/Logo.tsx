import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "dark" | "white";
  className?: string;
  priority?: boolean;
  label?: string;
};

export function Logo({
  variant = "dark",
  className,
  priority = false,
  label = "Islamskole Bærum",
}: LogoProps) {
  const src = variant === "white" ? "/brand/logo-white.png" : "/brand/logo.png";
  return (
    <Link
      href="/"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Image
        src={src}
        alt={label}
        width={180}
        height={64}
        priority={priority}
        className="h-11 w-auto sm:h-12"
      />
    </Link>
  );
}
