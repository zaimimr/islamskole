"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  bulkUpdateApplicationStatus,
  bulkUpdateTeacherStatus,
} from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";

type BulkEntity = "applications" | "teachers";

type StatusOption = { value: string; label: string };

const applicationStatuses: StatusOption[] = [
  { value: "ny", label: "Ny" },
  { value: "kontaktet", label: "Kontaktet" },
  { value: "akseptert", label: "Akseptert" },
  { value: "avslatt", label: "Avslått" },
  { value: "arkivert", label: "Arkivert" },
];

const teacherStatuses: StatusOption[] = [
  { value: "ny", label: "Ny" },
  { value: "kontaktet", label: "Kontaktet" },
  { value: "arkivert", label: "Arkivert" },
];

type BulkContextValue = {
  selected: Set<string>;
  allIds: string[];
  toggle: (id: string) => void;
  toggleAll: () => void;
};

const BulkContext = createContext<BulkContextValue | null>(null);

function useBulk() {
  const context = useContext(BulkContext);
  if (!context) {
    throw new Error("Bulk components must be used inside BulkActions");
  }
  return context;
}

export function BulkActions({
  entity,
  ids,
  children,
}: {
  entity: BulkEntity;
  ids: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const statuses =
    entity === "teachers" ? teacherStatuses : applicationStatuses;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }

  function handleApply() {
    if (selected.size === 0) {
      toast.error("Ingen rader valgt");
      return;
    }
    if (!status) {
      toast.error("Velg en status");
      return;
    }
    const targetIds = [...selected];
    startTransition(async () => {
      const result =
        entity === "teachers"
          ? await bulkUpdateTeacherStatus(targetIds, status)
          : await bulkUpdateApplicationStatus(targetIds, status);
      if (result.ok) {
        toast.success(`Status oppdatert for ${targetIds.length} rader`);
        setSelected(new Set());
        setStatus("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const value = useMemo<BulkContextValue>(
    () => ({ selected, allIds: ids, toggle, toggleAll }),
    [selected, ids],
  );

  return (
    <BulkContext.Provider value={value}>
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">
            {selected.size} valgt
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Velg status</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleApply} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Oppdater status
          </Button>
        </div>
      ) : null}
      {children}
    </BulkContext.Provider>
  );
}

export function BulkSelectAll() {
  const { selected, allIds, toggleAll } = useBulk();
  const checked = allIds.length > 0 && selected.size === allIds.length;
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={toggleAll}
      aria-label="Velg alle"
      className="size-4 rounded border-input accent-primary"
    />
  );
}

export function BulkRowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useBulk();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label="Velg rad"
      className="size-4 rounded border-input accent-primary"
    />
  );
}
