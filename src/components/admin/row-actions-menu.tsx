"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, type LucideIcon } from "lucide-react";
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

export type RowAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  run: () => Promise<ActionResult>;
  success: string;
  destructive?: boolean;
  confirm?: { title: string; description: string; confirmLabel: string };
};

export function RowActionsMenu({
  label,
  actions,
}: {
  label: string;
  actions: RowAction[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<RowAction | null>(null);

  function execute(action: RowAction) {
    startTransition(async () => {
      const result = await action.run();
      if (result.ok) {
        toast.success(action.success);
        setConfirming(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function select(action: RowAction) {
    if (action.confirm) {
      setConfirming(action);
      return;
    }
    execute(action);
  }

  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-xl"
              aria-label={label}
              title={label}
              disabled={pending}
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <MoreHorizontal aria-hidden="true" className="size-5" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="min-w-56 [&_[role=menuitem]]:min-h-11"
        >
          {regular.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem key={action.id} onClick={() => select(action)}>
                {Icon ? <Icon aria-hidden="true" /> : null}
                {action.label}
              </DropdownMenuItem>
            );
          })}
          {regular.length > 0 && destructive.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {destructive.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                variant="destructive"
                onClick={() => select(action)}
              >
                {Icon ? <Icon aria-hidden="true" /> : null}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirming != null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirming && execute(confirming)}
              disabled={pending}
              variant={confirming?.destructive ? "destructive" : "default"}
              className="min-h-11"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirming?.confirm?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
