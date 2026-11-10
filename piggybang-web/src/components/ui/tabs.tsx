"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

/**
 * Pill bar. Scrolls sideways on narrow screens (never vertically), scrollbar hidden.
 * Chevrons appear on the side(s) with hidden tabs; the active tab is kept in view.
 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });

  React.useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const update = () =>
      setEdges({
        left: list.scrollLeft > 1,
        right: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
      });
    const center = (smooth: boolean) => {
      const tab = list.querySelector<HTMLElement>('[data-state="active"]');
      if (!tab || list.scrollWidth <= list.clientWidth) return;
      // Scroll the bar only (scrollIntoView would also scroll the page).
      list.scrollTo({
        left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2,
        behavior: smooth ? "smooth" : "instant",
      });
    };
    center(false);
    const mo = new MutationObserver(() => center(true));
    mo.observe(list, { subtree: true, attributeFilter: ["data-state"] });
    const ro = new ResizeObserver(update); // also fires once on observe
    ro.observe(list);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      mo.disconnect();
      ro.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);

  const scroll = (dir: -1 | 1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });

  // Mouse/touch affordance only: keyboard users move between tabs with arrow keys.
  // A fade over the edge plus a small frosted chevron; fades in/out instead of popping.
  const chevron = (dir: -1 | 1) => {
    const show = dir < 0 ? edges.left : edges.right;
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => scroll(dir)}
        className={cn(
          "group/chev absolute inset-y-0 z-10 flex w-12 items-center transition-opacity duration-200",
          dir < 0
            ? "left-0 justify-start rounded-l-xl bg-linear-to-r from-muted via-muted/70 to-transparent pl-1"
            : "right-0 justify-end rounded-r-xl bg-linear-to-l from-muted via-muted/70 to-transparent pr-1",
          show ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <span className="grid size-7 place-items-center rounded-full bg-background/50 text-foreground/60 shadow-[0_1px_3px_rgb(0_0_0/0.08)] backdrop-blur-sm transition-[background-color,color,transform] duration-200 group-hover/chev:bg-background/90 group-hover/chev:text-foreground group-active/chev:scale-90">
          {dir < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
      </button>
    );
  };

  return (
    <div className="relative w-fit max-w-full">
      {chevron(-1)}
      <TabsPrimitive.List
        ref={ref}
        data-slot="tabs-list"
        className={cn(
          "relative flex w-fit max-w-full items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl bg-muted p-1 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        {...props}
      />
      {chevron(1)}
    </div>
  );
}

/** Put a lucide icon before the label: <TabsTrigger value="x"><Icon />Label</TabsTrigger> */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap",
        "transition-[color,background-color,box-shadow,transform] duration-200 ease-out hover:bg-background/60 hover:text-foreground active:scale-[0.97]",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-input/40",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-70 [&_svg]:transition-[opacity,transform] [&_svg]:duration-200 data-[state=active]:[&_svg]:scale-110 data-[state=active]:[&_svg]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 text-sm outline-none animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
