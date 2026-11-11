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
    // No enter/leave bookkeeping: a missed pointerleave would leave the strip paused for good. Ask the browser.
    const canHover = matchMedia("(hover: hover)").matches; // touch screens keep :hover stuck after a tap
    let resumeAt = 0;
    let down = false;
    let last = performance.now();
    let drag: { x: number; left: number } | null = null;
    let raf = 0;

    const release = () => (resumeAt = performance.now() + RESUME_MS);
    const paused = (now: number) => down || now < resumeAt || (canHover && el.matches(":hover"));
    const wrap = () => {
      // keep the user inside the loop: jump by one full set, which looks identical
      if (el.scrollLeft >= half()) el.scrollLeft -= half();
      else if (el.scrollLeft <= 0) el.scrollLeft += half();
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      if (e.pointerType === "mouse") drag = { x: e.clientX, left: el.scrollLeft };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      el.scrollLeft = drag.left - (e.clientX - drag.x);
      wrap();
      drag = { x: e.clientX, left: el.scrollLeft };
    };
    const onUp = () => {
      if (down) release();
      down = false;
      drag = null;
    };
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!paused(now)) {
        pos = (pos + (SPEED * dt) / 1000) % half();
        el.scrollLeft = pos;
      } else {
        wrap();
        pos = el.scrollLeft; // continue from wherever the user left it
      }
      raf = requestAnimationFrame(tick);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("wheel", release, { passive: true }); // trackpad
    el.addEventListener("touchmove", release, { passive: true }); // swipe + momentum
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
    if (auto) raf = requestAnimationFrame(tick);
    else el.addEventListener("scroll", wrap, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("wheel", release);
      el.removeEventListener("touchmove", release);
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
