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
import { GripVertical, Pencil } from "lucide-react";
import { reorderClasses, deleteClass } from "@/app/[locale]/admin/actions";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { cn } from "@/lib/utils";

export type SortableClass = {
  id: string;
  name: string;
  age: string;
  published: boolean;
};

function Row({ item, basePath }: { item: SortableClass; basePath: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 bg-card px-4 py-3",
        isDragging && "relative z-10 rounded-xl shadow-lg ring-1 ring-primary/40",
      )}
    >
      <button
        type="button"
        aria-label="Dra for å endre rekkefølge"
        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">{item.age}</p>
      </div>
      <Badge variant={item.published ? "default" : "secondary"}>
        {item.published ? "Publisert" : "Utkast"}
      </Badge>
      <Link
        href={`${basePath}/klasser/${item.id}`}
        aria-label="Rediger"
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <Pencil className="size-4" />
      </Link>
      <DeleteButton id={item.id} label="klasse" action={deleteClass} />
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      const res = await reorderClasses(next.map((i) => i.id));
      if (res.ok) {
        toast.success("Rekkefølge lagret");
      } else {
        toast.error(res.error);
        setItems(items);
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
        <ul className={cn("divide-y divide-border", pending && "opacity-70")}>
          {items.map((item) => (
            <Row key={item.id} item={item} basePath={basePath} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
