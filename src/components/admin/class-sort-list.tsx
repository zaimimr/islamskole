"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { reorderClasses, deleteClass } from "@/app/[locale]/admin/actions";
import { Badge } from "@/components/ui/badge";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { cn } from "@/lib/utils";

export type SortableClass = {
  id: string;
  name: string;
  age: string;
  capacity: number | null;
  enrolled: number;
  price: number | null;
  published: boolean;
};

function CapacityMeter({
  enrolled,
  capacity,
}: {
  enrolled: number;
  capacity: number | null;
}) {
  const ratio = capacity ? Math.min(enrolled / capacity, 1) : 0;
  const full = capacity != null && enrolled >= capacity;
  return (
    <div className="grid w-full gap-1 sm:w-32">
      <span className="text-sm tabular-nums">
        <span className="font-bold">{enrolled}</span>
        {capacity != null ? ` / ${capacity}` : ""} elever
        {full ? <span className="font-bold text-[#8B2F2B]"> · Full</span> : null}
      </span>
      {capacity != null ? (
        <span
          aria-hidden="true"
          className="h-1.5 overflow-hidden rounded-full bg-[#ECE8DF]"
        >
          <span
            className={cn(
              "block h-full rounded-full",
              full ? "bg-[#C5524C]" : "bg-[#3C8F44]",
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

function Row({ item, basePath }: { item: SortableClass; basePath: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 bg-white px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] sm:px-5",
        isDragging &&
          "relative z-10 rounded-xl shadow-[0_12px_32px_rgba(45,55,43,0.14)] ring-1 ring-[#8DB793]",
      )}
    >
      <button
        type="button"
        aria-label="Dra for å endre rekkefølge"
        title="Dra for å endre rekkefølge"
        className="col-start-1 row-span-2 row-start-1 flex size-11 cursor-grab touch-none items-center justify-center self-center rounded-xl text-admin-muted outline-none transition-colors hover:bg-[#F2F1EB] active:cursor-grabbing focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-start-auto sm:row-span-1 sm:row-start-auto"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <Link
        href={`${basePath}/klasser/${item.id}`}
        className="col-start-2 row-start-1 min-w-0 rounded-lg sm:col-start-auto sm:row-start-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="block truncate font-bold underline-offset-4 hover:underline">
          {item.name}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-admin-muted">
          <span>{item.age}</span>
          {item.price != null ? (
            <span className="tabular-nums text-[#775108]">
              {item.price.toLocaleString("nb-NO")} kr per år, overstyrer
              årsavgiften
            </span>
          ) : null}
        </span>
      </Link>
      <div className="col-start-2 row-start-2 sm:col-start-auto sm:row-start-auto">
        <CapacityMeter enrolled={item.enrolled} capacity={item.capacity} />
      </div>
      <Badge
        variant={item.published ? "default" : "secondary"}
        className={cn(
          "col-start-3 row-start-1 w-fit justify-self-end sm:col-start-auto sm:row-start-auto sm:justify-self-auto",
          item.published && "bg-[#DCEDDD] text-[#216A2B] hover:bg-[#DCEDDD]",
        )}
      >
        {item.published ? "Publisert" : "Utkast"}
      </Badge>
      <div className="col-start-3 row-start-2 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
        <RowActionsMenu
          label={`Handlinger for ${item.name}`}
          actions={[
            {
              id: "delete",
              label: "Slett klasse",
              icon: Trash2,
              destructive: true,
              run: () => deleteClass(item.id),
              success: "Klassen er slettet",
              confirm: {
                title: `Slette ${item.name}?`,
                description:
                  "Klassen fjernes fra nettsiden og kan ikke gjenopprettes. Klasser med elever plassert kan ikke slettes.",
                confirmLabel: "Slett klasse",
              },
            },
          ]}
        />
      </div>
    </li>
  );
}

export function ClassSortList({
  classes,
  basePath,
}: {
  classes: SortableClass[];
  basePath: string;
}) {
  const [items, setItems] = useState(classes);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const previous = items;
    const next = arrayMove(previous, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      const res = await reorderClasses(next.map((i) => i.id));
      if (res.ok) {
        toast.success("Rekkefølge lagret");
      } else {
        toast.error(res.error);
        setItems(previous);
      }
    });
  }

  return (
    <DndContext
      id="class-sort"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          aria-busy={pending}
          className={cn("divide-y divide-[#ECE8DF]", pending && "opacity-70")}
        >
          {items.map((item) => (
            <Row key={item.id} item={item} basePath={basePath} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
