import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  newHref,
  newLabel,
  action,
}: {
  title: string;
  description?: string;
  newHref?: string;
  newLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action || newHref ? (
        <div className="flex flex-wrap items-center gap-2 [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl">
          {action ?? null}
          {newHref ? (
            <Link
              href={newHref}
              className={buttonVariants({
                className:
                  "min-h-11 rounded-xl bg-admin-action px-4 font-bold text-white transition-colors hover:bg-[#245E2B]",
              })}
            >
              <Plus aria-hidden="true" className="size-4" />
              {newLabel ?? "Ny"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
