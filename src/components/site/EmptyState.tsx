import { SproutIcon } from "lucide-react";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-primary/25 bg-card/60 px-6 py-16 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/12 text-brand-green-dark">
        <SproutIcon className="size-7" aria-hidden="true" />
      </span>
      <p className="max-w-md text-lg text-muted-foreground text-balance-pretty">
        {message}
      </p>
    </div>
  );
}
