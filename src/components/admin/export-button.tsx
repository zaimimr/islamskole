"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Entity = "students" | "applications" | "payments" | "teachers";

export function ExportButton({ entity }: { entity: Entity }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const href = query
    ? `/api/export/${entity}?${query}`
    : `/api/export/${entity}`;

  return (
    <a
      href={href}
      download
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      <Download className="size-4" />
      Eksporter CSV
    </a>
  );
}
