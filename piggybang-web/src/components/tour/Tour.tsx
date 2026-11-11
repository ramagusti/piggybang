"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/components/layout/AppShell";
import { Carousel } from "@/components/marketing/Carousel";
import { DemoChat } from "@/components/marketing/DemoChat";
import { Piggy } from "@/components/piggy/Piggy";
import { Button } from "@/components/ui/button";
import { queryKeys, useMe } from "@/hooks/api";
import { useFormat } from "@/hooks/use-utils";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { User } from "@/types";
import { STEPS, counted, countFor, nextIndex, resumeIndex, type TourStep } from "./steps";

type Me = { user: User; organizations: unknown[] };
const TICK_MS = 150;
const MISSING_MS = 2500; // a target that never shows up (no budgets yet, viewer, …) skips its step

/** Saves tour progress on the user (resume + drop-off), updating the cached /user right away. */
function useTourSave() {
  const qc = useQueryClient();
  return useCallback(
    (body: { step?: string; status?: "completed" | "skipped" | null }) => {
      const patch: Partial<User> = {};
      if ("status" in body) patch.tour_status = body.status ?? null;
      if (body.status === null) patch.tour_step = null; // replay starts from the top
      if (body.step) patch.tour_step = body.step;
      qc.setQueryData<Me>(queryKeys.me, (old) => old && { ...old, user: { ...old.user, ...patch } });
      api<{ user: User }>("/user/tour", { method: "PATCH", body }).catch(() => {}); // progress is best-effort; never block the app
    },
    [qc],
  );
}

/** First visible element for the step's targets. */
function findTarget(step: TourStep): HTMLElement | null {
  for (const id of step.targets ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

/** Closes whatever form dialog/sheet is open, the way its own ✕ button would. */
function closeOpenDialog() {
  const btn = document.querySelector<HTMLElement>('[data-slot="dialog-content"] [data-slot="dialog-close"], [data-slot="sheet-content"] [data-slot="sheet-close"]');
  if (btn) btn.click();
  else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

/**
 * First-login tour (spec: tour script in the PR). Runs once per user after the team is set up; the user's progress
 * and whether they finished or skipped are saved on their account. Settings → Replay starts it again.
 */
export function Tour() {
  const { org, can } = useOrg();
  const { data: me } = useMe();
  const save = useTourSave();
  const router = useRouter();
  const pathname = usePathname();
  const ctx = { can };
  const user = me?.user;
  const active = !!user && user.tour_status === null && !!org.settings?.onboarded;

  // `index` is only set once the user moves; until then the tour starts where their saved progress says.
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const target = useRef<HTMLElement | null>(null);
  const path = useRef(pathname);
  const current = active ? (index ?? nextIndex(resumeIndex(user?.tour_step), ctx)) : null;
  const step = current !== null && current < STEPS.length ? STEPS[current] : null;

  const end = (status: "completed" | "skipped") => {
    save({ status, step: step?.id });
    setIndex(null);
  };

  // Latest values for the timers and listeners below, which outlive a render.
  const advance = useRef(() => {});
  useLayoutEffect(() => {
    path.current = pathname;
    advance.current = () => {
      if (current === null) return;
      setConfirmSkip(false);
      setRect(null);
      const next = nextIndex(current + 1, ctx);
      if (next >= STEPS.length) return end("completed");
      setIndex(next);
      save({ step: STEPS[next].id });
    };
  });

  // Resuming (or a step on another page): go where the step lives.
  useEffect(() => {
    if (step?.page && path.current !== step.page) router.push(step.page);
  }, [step, router]);

  // "route" steps: done once the user got there (clicking the nav item, maybe via "More" on mobile).
  useEffect(() => {
    if (step?.advance === "route" && step.route && pathname.startsWith(step.route)) advance.current();
  }, [step, pathname]);

  // Track the highlighted element; skip steps whose target isn't there; finish "gone"/"wait" steps when it closes.
  useEffect(() => {
    if (!step?.targets) {
      target.current = null;
      return;
    }
    let seen = false;
    let since = Date.now();
    let goneTicks = 0;
    const tick = () => {
      const el = findTarget(step);
      target.current = el;
      if (el) {
        if (!seen) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        seen = true;
        goneTicks = 0;
        setRect(el.getBoundingClientRect());
        return;
      }
      setRect(null);
      if (step.page && path.current !== step.page) since = Date.now(); // still navigating there
      if (seen && (step.advance === "gone" || step.advance === "wait")) {
        if (++goneTicks >= 2) advance.current();
      } else if (!seen && Date.now() - since > MISSING_MS) advance.current();
    };
    tick();
    // ponytail: polling keeps up with scrolling, resizing and elements that render late; a few rect reads per tick are cheap
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [step]);

  // "click" steps: the real element does its thing, then we move on.
  useEffect(() => {
    if (step?.advance !== "click") return;
    const onClick = (e: MouseEvent) => {
      if (target.current?.contains(e.target as Node)) setTimeout(() => advance.current(), 0);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step]);

  if (!step || typeof document === "undefined") return null;
  if (step.advance === "wait") return null; // the user is looking at what they opened
  if (step.targets && !rect) return null; // waiting for the element (or the page) to appear

  return createPortal(
    <TourLayer
      step={step}
      rect={rect}
      position={STEPS.slice(0, current! + 1).filter((s) => counted(s, ctx)).length}
      total={countFor(ctx)}
      confirmSkip={confirmSkip}
      onSkip={() => (confirmSkip ? end("skipped") : setConfirmSkip(true))}
      onCancelSkip={() => setConfirmSkip(false)}
      onNext={() => advance.current()}
      onPlans={() => {
        end("completed");
        router.push("/app/settings?tab=billing");
      }}
    />,
    document.body,
  );
}

const PAD = 6;

function TourLayer({
  step,
  rect,
  position,
  total,
  confirmSkip,
  onSkip,
  onCancelSkip,
  onNext,
  onPlans,
}: {
  step: TourStep;
  rect: DOMRect | null;
  position: number;
  total: number;
  confirmSkip: boolean;
  onSkip: () => void;
  onCancelSkip: () => void;
  onNext: () => void;
  onPlans: () => void;
}) {
  const t = useTranslations("tour");
  const f = useFormat();
  const { org, can } = useOrg();
  const key = `steps.${step.id}`;
  const rich = (k: string, values: Record<string, string> = {}) =>
    t.rich(k, { ...values, b: (c) => <strong>{c}</strong>, code: (c) => <code className="rounded bg-muted px-1 font-mono text-[0.85em]">{c}</code> });
  const card = (step.body === "carousel" ? "w-[min(40rem,calc(100vw-2rem))]" : "w-[min(22rem,calc(100vw-2rem))]") + " fixed z-[101] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border bg-surface p-4 shadow-2xl pointer-events-auto";

  // Below the highlight when there's room, else above, else pinned to the bottom (tall forms on phones).
  let place: React.CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(352, vw - 32);
    const left = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, 16), vw - w - 16);
    place =
      vh - rect.bottom > 200 ? { top: rect.bottom + PAD + 10, left }
      : rect.top > 200 ? { bottom: vh - rect.top + PAD + 10, left }
      : { bottom: 16, left };
  }

  const primary = step.advance === "next";
  const finishText =
    org.is_trialing && org.trial_ends_at ? rich("finishTrial", { date: f.date(org.trial_ends_at) })
    : org.plan === "pro" ? rich("finishPro")
    : rich("finishFree");

  return (
    <div data-tour-ui className="pointer-events-none fixed inset-0 z-[100]" aria-live="polite">
      {rect ? (
        <>
          {/* Dim everything but the highlight; the highlight itself stays usable for "click"/"route"/"gone" steps. */}
          <div className="pointer-events-auto fixed inset-x-0 top-0 bg-black/55" style={{ height: Math.max(rect.top - PAD, 0) }} />
          <div className="pointer-events-auto fixed inset-x-0 bottom-0 bg-black/55" style={{ top: rect.bottom + PAD }} />
          <div className="pointer-events-auto fixed left-0 bg-black/55" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, width: Math.max(rect.left - PAD, 0) }} />
          <div className="pointer-events-auto fixed right-0 bg-black/55" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: rect.right + PAD }} />
          {primary ? (
            <button
              type="button"
              aria-label={t("next")}
              onClick={onNext}
              className="pointer-events-auto fixed animate-pulse rounded-xl ring-4 ring-primary"
              style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
            />
          ) : (
            <div className="fixed rounded-xl ring-4 ring-primary" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
          )}
        </>
      ) : (
        <div className="pointer-events-auto fixed inset-0 bg-black/55" />
      )}

      <section role="dialog" aria-label={t(`${key}.title`)} className={card} style={place}>
        <div className="mb-2 flex items-center gap-2">
          {!rect && <Piggy state={step.body === "finish" ? "wave" : "point"} size={40} />}
          <div className="min-w-0 flex-1">
            {step.body !== "finish" && step.id !== "welcome" && <p className="text-xs text-muted-foreground">{t("progress", { n: position, total })}</p>}
            <h2 className="font-semibold">{t(`${key}.title`)}</h2>
          </div>
        </div>
        <div className="space-y-2 text-sm leading-relaxed">
          <p>{rich(`${key}.body`)}</p>
          {step.body === "finish" && (
            <>
              <p>{finishText}</p>
              <p className="text-muted-foreground">{t("replayHint")}</p>
            </>
          )}
        </div>
        {step.body === "carousel" && (
          <Carousel className="-mx-4 mt-3">
            {(["record", "budget", "over", "reminder", "ask"] as const).map((scene) => (
              <DemoChat key={scene} scene={scene} className="max-w-none text-xs" />
            ))}
          </Carousel>
        )}

        {confirmSkip ? (
          <div className="mt-4 space-y-2 rounded-xl bg-muted p-3 text-sm">
            <p>{t("skipConfirm")}</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onCancelSkip}>
                {t("skipCancel")}
              </Button>
              <Button size="sm" variant="destructive" onClick={onSkip}>
                {t("skipYes")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {step.body !== "finish" && (
              <Button size="sm" variant="ghost" className="mr-auto text-muted-foreground" onClick={onSkip}>
                {t("skip")}
              </Button>
            )}
            {!primary && !step.close && <span className="text-xs text-muted-foreground">👆 {t("tapHighlight")}</span>}
            {step.close && (
              <Button size="sm" variant="outline" onClick={closeOpenDialog}>
                {t(`${key}.action`)}
              </Button>
            )}
            {step.body === "finish" && can("billing.manage") && (
              <Button size="sm" variant="outline" onClick={onPlans}>
                {t("seePlans")}
              </Button>
            )}
            {primary && (
              <Button size="sm" onClick={onNext}>
                {t.has(`${key}.action`) ? t(`${key}.action`) : t("next")}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Settings → start the tour again. */
export function ReplayTour() {
  const t = useTranslations("tour");
  const save = useTourSave();
  const router = useRouter();
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4">
      <div>
        <p className="font-medium">{t("replayTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("replayBody")}</p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          save({ status: null });
          router.push("/app/dashboard");
        }}
      >
        {t("replay")}
      </Button>
    </div>
  );
}
