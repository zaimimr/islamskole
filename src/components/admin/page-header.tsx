import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  newHref,
  newLabel,
}: {
  title: string;
  description?: string;
  newHref?: string;
  newLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {newHref ? (
        <Link href={newHref} className={buttonVariants()}>
          <Plus className="size-4" />
          {newLabel ?? "Ny"}
        </Link>
      ) : null}
    </div>
  );
}
