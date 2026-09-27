"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ActionResult = { ok: true } | { ok: false; error: string };

export type RowActionLink = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

export type RowActionDestructive = {
  id: string;
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  successMessage?: string;
  action: (id: string) => Promise<ActionResult>;
};

export function RowActions({
  label,
  links = [],
  destructive,
}: {
  label: string;
  links?: RowActionLink[];
  destructive?: RowActionDestructive;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!destructive) return;
    startTransition(async () => {
      const result = await destructive.action(destructive.id);
      if (result.ok) {
        toast.success(destructive.successMessage ?? "Slettet");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={label}
              title={label}
              className="text-admin-muted hover:text-foreground"
            />
          }
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-52">
          {links.map((link) => (
            <DropdownMenuItem
              key={link.href}
              render={<Link href={link.href} />}
            >
              {link.icon}
              {link.label}
            </DropdownMenuItem>
          ))}
          {links.length > 0 && destructive ? <DropdownMenuSeparator /> : null}
          {destructive ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              {destructive.label}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {destructive ? (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{destructive.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {destructive.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleConfirm}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {destructive.confirmLabel ?? "Slett"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
