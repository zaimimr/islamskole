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
import { GripVertical, Pencil, UsersRound } from "lucide-react";
import { reorderClasses, deleteClass } from "@/app/[locale]/admin/actions";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { cn } from "@/lib/utils";

export type SortableClass = {
  id: string;
  name: string;
  age: string;
  capacity: number | null;
  price: number | null;
  published: boolean;
};

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
        "grid gap-3 bg-white px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:px-5",
        isDragging &&
          "relative z-10 rounded-xl shadow-[0_12px_32px_rgba(45,55,43,0.14)] ring-1 ring-[#8DB793]",
      )}
    >
      <button
        type="button"
        aria-label="Dra for å endre rekkefølge"
        title="Dra for å endre rekkefølge"
        className="row-span-2 flex size-11 cursor-grab touch-none items-center justify-center self-center rounded-xl text-admin-muted outline-none transition-colors hover:bg-[#F2F1EB] active:cursor-grabbing focus-visible:ring-3 focus-visible:ring-ring/50 sm:row-span-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <div className="min-w-0">
        <p className="truncate font-bold">{item.name}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-admin-muted">
          <span>{item.age}</span>
          {item.capacity != null ? (
            <span className="inline-flex items-center gap-1.5">
              <UsersRound aria-hidden="true" className="size-3.5" />
              Kapasitet {item.capacity}
            </span>
          ) : null}
          <span className="tabular-nums">
            {item.price != null
              ? `${item.price.toLocaleString("nb-NO")} kr per termin`
              : "Pris ikke satt"}
          </span>
        </div>
      </div>
      <Badge
        variant={item.published ? "default" : "secondary"}
        className={cn(
          "w-fit",
          item.published && "bg-[#DCEDDD] text-[#216A2B] hover:bg-[#DCEDDD]",
        )}
      >
        {item.published ? "Publisert" : "Utkast"}
      </Badge>
      <div className="col-start-2 flex items-center gap-1 sm:col-start-auto">
        <Link
          href={`${basePath}/klasser/${item.id}`}
          aria-label={`Rediger ${item.name}`}
          title="Rediger klasse"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Link>
        <DeleteButton id={item.id} label="klasse" action={deleteClass} />
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
