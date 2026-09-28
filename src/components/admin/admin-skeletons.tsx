import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const card = "rounded-2xl bg-white ring-1 ring-[#E3DED3]";

export function PageSkeleton({
  label = "Laster …",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("grid gap-6 lg:gap-7", className)}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function HeaderSkeleton({
  back = false,
  actions = 0,
  description = true,
}: {
  back?: boolean;
  actions?: number;
  description?: boolean;
}) {
  return (
    <div>
      {back ? <Skeleton className="mb-3 h-10 w-28 rounded-lg" /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-2">
          <Skeleton className="h-9 w-56 max-w-full rounded-lg sm:h-10" />
          {description ? (
            <Skeleton className="h-5 w-80 max-w-full rounded-lg" />
          ) : null}
        </div>
        {actions > 0 ? (
          <div className="flex gap-2">
            {Array.from({ length: actions }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-32 rounded-xl" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TabsSkeleton({ tabs = 2 }: { tabs?: number }) {
  return (
    <div className="flex gap-3 border-b border-[#E3DED3] pb-3">
      {Array.from({ length: tabs }).map((_, index) => (
        <Skeleton key={index} className="h-5 w-24 rounded-lg" />
      ))}
    </div>
  );
}

export function StatStripSkeleton({ stacked = false }: { stacked?: boolean }) {
  return (
    <div
      className={cn(
        card,
        "grid overflow-hidden",
        stacked
          ? "divide-y divide-[#ECE8DF] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          : "grid-cols-3 divide-x divide-[#ECE8DF]",
      )}
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-3 px-3 py-3 sm:min-h-24 sm:px-5 sm:py-4",
            stacked && "min-h-24 px-4",
          )}
        >
          <Skeleton
            className={cn(
              "size-10 shrink-0 rounded-full",
              !stacked && "hidden sm:block",
            )}
          />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-6 w-16 rounded-lg" />
            <Skeleton className="h-3 w-20 max-w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FilterSkeleton() {
  return (
    <div
      className={cn(
        card,
        "grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:p-5",
      )}
    >
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="hidden h-11 rounded-xl sm:block" />
      <Skeleton className="hidden h-11 w-24 rounded-xl sm:block" />
    </div>
  );
}

function CardHeadSkeleton() {
  return (
    <div className="grid gap-2 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
      <Skeleton className="h-6 w-44 max-w-full rounded-lg" />
      <Skeleton className="h-4 w-64 max-w-full rounded-lg" />
    </div>
  );
}

export function ListCardSkeleton({
  rows = 5,
  lead,
  tall = false,
  head = true,
}: {
  rows?: number;
  lead?: "avatar" | "tile" | "handle";
  tall?: boolean;
  head?: boolean;
}) {
  return (
    <div className={cn(card, "overflow-hidden")}>
      {head ? <CardHeadSkeleton /> : null}
      <div className="divide-y divide-[#ECE8DF]">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-4 px-4 sm:px-5",
              tall ? "min-h-44 py-5" : "min-h-[4.5rem] py-4",
            )}
          >
            {lead === "avatar" ? (
              <Skeleton className="hidden size-10 shrink-0 rounded-full sm:block" />
            ) : null}
            {lead === "tile" ? (
              <Skeleton className="size-14 shrink-0 rounded-xl" />
            ) : null}
            {lead === "handle" ? (
              <Skeleton className="size-11 shrink-0 rounded-xl" />
            ) : null}
            <div className="grid min-w-0 flex-1 gap-2">
              <Skeleton className="h-5 w-48 max-w-full rounded-lg" />
              <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
              {tall ? (
                <Skeleton className="mt-2 h-16 w-full max-w-xl rounded-xl" />
              ) : null}
            </div>
            <Skeleton className="hidden h-8 w-24 shrink-0 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({
  className,
  head = true,
}: {
  className?: string;
  head?: boolean;
}) {
  return (
    <div className={cn(card, "overflow-hidden")}>
      {head ? <CardHeadSkeleton /> : null}
      <div className={cn("grid gap-3 p-4 sm:p-5", className)}>
        <Skeleton className="h-4 w-full rounded-lg" />
        <Skeleton className="h-4 w-5/6 rounded-lg" />
        <Skeleton className="h-4 w-2/3 rounded-lg" />
      </div>
    </div>
  );
}

export function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="grid gap-5">
      {Array.from({ length: sections }).map((_, index) => (
        <div key={index} className={cn(card, "overflow-hidden")}>
          <CardHeadSkeleton />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {Array.from({ length: 4 }).map((_, field) => (
              <div key={field} className="grid gap-2">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
