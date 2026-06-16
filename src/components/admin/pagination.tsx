import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page") continue;
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      }
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <div className="flex items-center justify-between gap-3 border-t p-4">
      <p className="text-sm text-muted-foreground">
        Side {currentPage} av {totalPages} · {total} totalt
      </p>
      <div className="flex items-center gap-2">
        {prevDisabled ? (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-50",
            )}
            aria-disabled="true"
          >
            <ChevronLeft className="size-4" />
            Forrige
          </span>
        ) : (
          <Link
            href={hrefForPage(currentPage - 1)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            scroll={false}
          >
            <ChevronLeft className="size-4" />
            Forrige
          </Link>
        )}
        {nextDisabled ? (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-50",
            )}
            aria-disabled="true"
          >
            Neste
            <ChevronRight className="size-4" />
          </span>
        ) : (
          <Link
            href={hrefForPage(currentPage + 1)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            scroll={false}
          >
            Neste
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
