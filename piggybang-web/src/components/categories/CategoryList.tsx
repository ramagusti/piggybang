"use client";
import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, Palette, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryDot } from "@/components/shared/CategoryPicker";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";
import { CategoryColorPicker } from "./CategoryColorPicker";

interface RowActions {
  canWrite: boolean;
  onRename: (c: Category, name: string) => void;
  onColor: (c: Category, color: string) => void;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}

function Row({ c, canWrite, onRename, onColor, onEdit, onDelete }: { c: Category } & RowActions) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, disabled: !canWrite });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [colorOpen, setColorOpen] = useState(false);

  const commit = () => {
    setEditing(false);
    if (name.trim() && name !== c.name) onRename(c, name.trim());
    else setName(c.name);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex min-h-14 items-center gap-3 border-b bg-surface px-3 last:border-b-0", isDragging && "relative z-10 shadow-lg")}
    >
      {canWrite && (
        <button type="button" className="grid size-11 cursor-grab touch-none place-items-center text-muted-foreground" aria-label={t("category.dragHandle", { name: c.name })} {...attributes} {...listeners}>
          <GripVertical className="size-5" />
        </button>
      )}
      <CategoryDot category={c} />
      {editing ? (
        <Input
          autoFocus
          aria-label={t("category.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setName(c.name);
              setEditing(false);
            }
          }}
          className="h-9 flex-1"
        />
      ) : (
        <span className="flex-1 truncate font-medium" onDoubleClick={() => canWrite && !c.is_system && setEditing(true)}>
          {c.name}
          {c.is_system && <span className="ml-2 text-xs text-muted-foreground">({t("category.system")})</span>}
        </span>
      )}
      <span className="hidden text-xs text-muted-foreground sm:inline">{t("category.txCount", { count: c.transactions_count })}</span>
      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverAnchor asChild>
          <span className="size-4 rounded-full border" style={{ background: c.color ?? "transparent" }} aria-hidden />
        </PopoverAnchor>
        <PopoverContent className="w-64">
          <CategoryColorPicker
            value={c.color}
            onChange={(color) => {
              onColor(c, color);
              setColorOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(c)}>
              <Pencil /> {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTimeout(() => setColorOpen(true))}>
              <Palette /> {t("category.color")}
            </DropdownMenuItem>
            {!c.is_system && (
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(c)}>
                <Trash2 /> {t("common.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

/** Drag-to-reorder list (dnd-kit; keyboard accessible). */
export function CategoryList({ categories, onReorder, ...actions }: { categories: Category[]; onReorder: (ids: number[]) => void } & RowActions) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [order, setOrder] = useState(categories);
  const [prevCats, setPrevCats] = useState(categories);
  if (prevCats !== categories) {
    setPrevCats(categories);
    setOrder(categories);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      order,
      order.findIndex((c) => c.id === active.id),
      order.findIndex((c) => c.id === over.id),
    );
    setOrder(next);
    onReorder(next.map((c) => c.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="overflow-hidden rounded-xl border bg-surface">
          {order.map((c) => (
            <Row key={c.id} c={c} {...actions} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
