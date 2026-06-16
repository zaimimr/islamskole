"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invitasjonslenke kopiert");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Kopier invitasjonslenke"
      title="Kopier invitasjonslenke"
      onClick={copy}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
    </Button>
  );
}
