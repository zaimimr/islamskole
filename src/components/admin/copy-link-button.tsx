"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({
  url,
  showLabel = false,
}: {
  url: string;
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Aktivitetslenke kopiert");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      variant={showLabel ? "outline" : "ghost"}
      size={showLabel ? "default" : "icon"}
      aria-label="Kopier aktivitetslenke"
      title="Kopier aktivitetslenke"
      onClick={copy}
      className={showLabel ? "min-h-11 px-3" : undefined}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Link2 aria-hidden="true" className="size-4" />
      )}
      {showLabel ? (copied ? "Kopiert" : "Kopier lenke") : null}
    </Button>
  );
}
