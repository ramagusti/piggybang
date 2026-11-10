"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CategoryRef } from "@/types";

export function CategoryDot({
  category,
}: {
  category: Pick<CategoryRef, "icon" | "color"> | null;
}) {
  if (category?.icon) return <span aria-hidden>{category.icon}</span>;
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 rounded-full"
      style={{ background: category?.color ?? "var(--text-tertiary)" }}
    />
  );
}

/** Searchable category combobox: recent first, optional "create new". */
export function CategoryPicker({
  categories,
  value,
  onChange,
  recentIds = [],
  onCreate,
  id,
  invalid,
}: {
  categories: CategoryRef[];
  value: number | null;
  onChange: (id: number) => void;
  recentIds?: number[];
  onCreate?: (name: string) => void;
  id?: string;
  invalid?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categories.find((c) => c.id === value);
  const recent = recentIds
    .map((rid) => categories.find((c) => c.id === rid))
    .filter((c): c is CategoryRef => !!c);
  const others = categories.filter((c) => !recentIds.includes(c.id));
  const exact = categories.some(
    (c) => c.name.toLowerCase() === search.trim().toLowerCase(),
  );

  const item = (c: CategoryRef, prefix: string) => (
    <CommandItem
      key={`${prefix}-${c.id}`}
      value={`${prefix}-${c.id}-${c.name}`}
      keywords={[c.name]}
      onSelect={() => {
        onChange(c.id);
        setOpen(false);
      }}
    >
      <CategoryDot category={c} />
      {c.name}
      <Check
        className={cn("ml-auto", value === c.id ? "opacity-100" : "opacity-0")}
      />
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <CategoryDot category={selected} /> {selected.name}
              </>
            ) : (
              <span className="text-muted-foreground">
                {t("category.pickPlaceholder")}
              </span>
            )}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={t("common.search")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t("category.none")}</CommandEmpty>
            {recent.length > 0 && (
              <CommandGroup heading={t("category.recent")}>
                {recent.map((c) => item(c, "r"))}
              </CommandGroup>
            )}
            <CommandGroup heading={t("category.all")}>
              {others.map((c) => item(c, "a"))}
            </CommandGroup>
            {onCreate && search.trim() && !exact && (
              <CommandGroup>
                <CommandItem
                  value={`create-${search}`}
                  onSelect={() => {
                    onCreate(search.trim());
                    setOpen(false);
                  }}
                >
                  <Plus /> {t("category.createNamed", { name: search.trim() })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
