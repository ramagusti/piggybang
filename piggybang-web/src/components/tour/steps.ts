import type { Permission } from "@/types";

export interface TourCtx {
  can: (p: Permission) => boolean;
}

/**
 * How the user moves on from a step:
 * - next:  click the highlight (nothing underneath fires) or the tooltip's button
 * - click: click the real highlighted element (it does its normal thing)
 * - route: get to `route` (clicking the nav item; on mobile maybe via "More" first)
 * - gone:  until the highlighted thing disappears (a form closed or was saved)
 * - wait:  no tour UI until the target (a list the user opened) disappears again
 */
export type Advance = "next" | "click" | "route" | "gone" | "wait";

export interface TourStep {
  id: string; // also the i18n key under tour.steps and what is saved as the user's progress
  advance: Advance;
  /** data-tour targets; the first visible one wins (e.g. a nav item, else the mobile "More" button). None = centered card. */
  targets?: string[];
  page?: string; // where the step lives; resuming navigates here
  route?: string; // for advance "route"
  resumeAt?: string; // steps inside a dialog restart from the step that opens it
  when?: (ctx: TourCtx) => boolean;
  close?: boolean; // offers a button that closes the open form ("Later" / "Close")
  body?: "carousel" | "finish";
}

const write = (c: TourCtx) => c.can("transactions.write");
const rules = (c: TourCtx) => c.can("rules.write");
const team = (c: TourCtx) => c.can("members.manage");

export const STEPS: TourStep[] = [
  { id: "welcome", advance: "next", page: "/app/dashboard" },
  { id: "summary", advance: "next", targets: ["summary"], page: "/app/dashboard" },
  { id: "txAdd", advance: "click", targets: ["tx-add"], page: "/app/dashboard", when: write },
  { id: "txForm", advance: "gone", targets: ["tx-form"], resumeAt: "txAdd", when: write, close: true },
  { id: "navTransactions", advance: "route", targets: ["nav-transactions"], route: "/app/transactions" },
  { id: "txList", advance: "next", targets: ["tx-list"], page: "/app/transactions" },
  { id: "navBudgets", advance: "route", targets: ["nav-budgets", "nav-more"], route: "/app/budgets" },
  { id: "tabPayday", advance: "click", targets: ["tab-payday"], page: "/app/budgets" },
  { id: "payday", advance: "next", targets: ["payday-card", "rule-new"], page: "/app/budgets" },
  { id: "tabWeekly", advance: "click", targets: ["tab-weekly"], page: "/app/budgets", when: rules },
  { id: "ruleNew", advance: "click", targets: ["rule-new"], page: "/app/budgets", when: rules },
  { id: "ruleAi", advance: "next", targets: ["rule-ai"], resumeAt: "tabWeekly", when: rules },
  { id: "ruleCategory", advance: "next", targets: ["rule-cat"], resumeAt: "tabWeekly", when: rules },
  { id: "ruleKeywords", advance: "next", targets: ["rule-kw"], resumeAt: "tabWeekly", when: rules },
  { id: "ruleClose", advance: "gone", targets: ["rule-form"], resumeAt: "tabWeekly", when: rules, close: true },
  { id: "budgetCard", advance: "click", targets: ["budget-card"], page: "/app/budgets" },
  { id: "budgetList", advance: "wait", targets: ["rule-tx"], resumeAt: "budgetCard" },
  { id: "navBills", advance: "route", targets: ["nav-bills"], route: "/app/bills" },
  { id: "navWhatsapp", advance: "route", targets: ["nav-whatsapp", "nav-more"], route: "/app/whatsapp" },
  { id: "waChats", advance: "next", page: "/app/whatsapp", body: "carousel" },
  { id: "waConnect", advance: "next", targets: ["wa-connect"], page: "/app/whatsapp" },
  { id: "navTeam", advance: "route", targets: ["nav-team", "nav-more"], route: "/app/team", when: team },
  { id: "teamInvite", advance: "next", targets: ["team-invite"], page: "/app/team", when: team },
  { id: "finish", advance: "next", body: "finish" },
];

/** First step at or after `from` that applies to this user; STEPS.length when none is left. */
export function nextIndex(from: number, ctx: TourCtx, steps = STEPS): number {
  let i = from;
  while (i < steps.length && steps[i].when && !steps[i].when!(ctx)) i++;
  return i;
}

/** Where to pick up after a reload: a step inside a dialog restarts at the step that opens it. */
export function resumeIndex(stepId: string | null | undefined, steps = STEPS): number {
  const step = steps.find((s) => s.id === stepId);
  const i = steps.findIndex((s) => s.id === (step?.resumeAt ?? stepId));
  return Math.max(i, 0);
}

/** Steps that count in the "3 / 18" counter: the ones this user sees, minus the welcome/finish cards. */
export const counted = (s: TourStep, ctx: TourCtx) => s.advance !== "wait" && s.id !== "welcome" && s.body !== "finish" && (!s.when || s.when(ctx));

export function countFor(ctx: TourCtx, steps = STEPS): number {
  return steps.filter((s) => counted(s, ctx)).length;
}
