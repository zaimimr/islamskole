"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ActionResult = { ok: true } | { ok: false; error: string };

type RemoveRow = (
  id: string,
  action: () => Promise<ActionResult>,
  successMessage: string,
) => void;

const RemoveRowContext = createContext<RemoveRow | null>(null);

export function useRemoveRow() {
  const removeRow = useContext(RemoveRowContext);
  if (!removeRow) {
    throw new Error("useRemoveRow must be used inside OptimisticRemovalList");
  }
  return removeRow;
}

export function OptimisticRemovalList({
  rows,
  className,
  itemClassName,
}: {
  rows: { id: string; content: React.ReactNode }[];
  className?: string;
  itemClassName?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [removedIds, hideRow] = useOptimistic<string[], string>(
    [],
    (current, id) => [...current, id],
  );

  function removeRow(
    id: string,
    action: () => Promise<ActionResult>,
    successMessage: string,
  ) {
    startTransition(async () => {
      hideRow(id);
      const result = await action();
      if (result.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <RemoveRowContext.Provider value={removeRow}>
      <ul className={className}>
        {rows
          .filter((row) => !removedIds.includes(row.id))
          .map((row) => (
            <li key={row.id} className={itemClassName}>
              {row.content}
            </li>
          ))}
      </ul>
    </RemoveRowContext.Provider>
  );
}
