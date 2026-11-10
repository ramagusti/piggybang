"use client";
import { Children, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const SPEED = 40; // px per second
const RESUME_MS = 1500; // auto-scroll resumes this long after the user lets go

/**
 * Endless strip that drifts by itself and can also be scrolled by the user (swipe, trackpad, mouse drag).
 * It is a real scroll container (scrollLeft is advanced each frame), so user scrolling just works; the drift
 * pauses while the user interacts. Slides are rendered twice for a seamless loop (the copy is hidden from
 * screen readers). Reduced motion: no drift, still scrollable.
 */
export function Carousel({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const auto = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const half = () => el.scrollWidth / 2;
    let pos = el.scrollLeft;
    let pausedUntil = 0; // Infinity while held
    let last = performance.now();
    let drag: { x: number; left: number } | null = null;
    let raf = 0;

    const hold = () => (pausedUntil = Infinity);
    const release = () => (pausedUntil = performance.now() + RESUME_MS);
    const nudge = () => pausedUntil !== Infinity && release(); // wheel / trackpad / momentum
    const wrap = () => {
      // keep the user inside the loop: jump by one full set, which looks identical
      if (el.scrollLeft >= half()) el.scrollLeft -= half();
      else if (el.scrollLeft <= 0) el.scrollLeft += half();
    };
    const onDown = (e: PointerEvent) => {
      hold();
      if (e.pointerType === "mouse") drag = { x: e.clientX, left: el.scrollLeft };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      el.scrollLeft = drag.left - (e.clientX - drag.x);
      wrap();
      drag = { x: e.clientX, left: el.scrollLeft };
    };
    const onUp = () => {
      drag = null;
      release();
    };
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (now > pausedUntil) {
        pos = (pos + (SPEED * dt) / 1000) % half();
        el.scrollLeft = pos;
      } else {
        wrap();
        pos = el.scrollLeft; // continue from wherever the user left it
      }
      raf = requestAnimationFrame(tick);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerenter", hold);
    el.addEventListener("pointerleave", onUp);
    el.addEventListener("wheel", nudge, { passive: true });
    el.addEventListener("touchmove", nudge, { passive: true });
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
    if (auto) raf = requestAnimationFrame(tick);
    else el.addEventListener("scroll", wrap, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerenter", hold);
      el.removeEventListener("pointerleave", onUp);
      el.removeEventListener("wheel", nudge);
      el.removeEventListener("touchmove", nudge);
      el.removeEventListener("scroll", wrap);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className={cn("[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]", className)}>
      <div ref={ref} className="cursor-grab overflow-x-auto overscroll-x-contain select-none [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-stretch py-2">
          {[false, true].map((copy) =>
            slides.map((slide, i) => (
              <div key={`${copy}-${i}`} aria-hidden={copy || undefined} className="mr-6 flex w-[min(22rem,82vw)] shrink-0">
                {slide}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
