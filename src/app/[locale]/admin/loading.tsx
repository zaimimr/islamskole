import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="grid gap-7" role="status" aria-live="polite">
      <span className="sr-only">Laster arbeidsflaten …</span>
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-5 w-80 max-w-full rounded-lg" />
        </div>
        <Skeleton className="hidden h-11 w-32 rounded-xl sm:block" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,0.78fr)]">
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
          <div className="grid gap-2 border-b border-[#ECE8DF] p-5">
            <Skeleton className="h-6 w-52 rounded-lg" />
            <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
          </div>
          <div className="grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-[5.25rem] items-center gap-4 border-b border-[#ECE8DF] px-5 last:border-b-0"
              >
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-44 max-w-full rounded-lg" />
                  <Skeleton className="h-3 w-72 max-w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <Skeleton className="mt-6 h-9 w-32 rounded-lg" />
            <div className="mt-5 grid gap-3 border-t border-[#ECE8DF] pt-4">
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
            </div>
            <Skeleton className="mt-5 h-11 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl bg-[#FFF8E9] p-5 ring-1 ring-[#ECDCB9]">
            <Skeleton className="h-5 w-36 rounded-lg" />
            <Skeleton className="mt-3 h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
