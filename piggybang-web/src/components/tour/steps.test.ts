import { describe, expect, it } from "vitest";
import type { Permission } from "@/types";
import { STEPS, countFor, nextIndex, resumeIndex } from "./steps";

const as = (...perms: Permission[]) => ({ can: (p: Permission) => perms.includes(p) });
const owner = as("transactions.write", "rules.write", "members.manage", "billing.manage");
const viewer = as();
const id = (i: number) => STEPS[i]?.id;

describe("tour steps", () => {
  it("skips what the user can't do", () => {
    expect(id(nextIndex(STEPS.findIndex((s) => s.id === "txAdd"), owner))).toBe("txAdd");
    expect(id(nextIndex(STEPS.findIndex((s) => s.id === "txAdd"), viewer))).toBe("navTransactions"); // no "add" for viewers
    expect(id(nextIndex(STEPS.findIndex((s) => s.id === "navTeam"), viewer))).toBe("finish");
    expect(nextIndex(STEPS.length, owner)).toBe(STEPS.length);
  });

  it("resumes a step inside a closed dialog at the step that opens it", () => {
    expect(id(resumeIndex("ruleKeywords"))).toBe("tabWeekly");
    expect(id(resumeIndex("txForm"))).toBe("txAdd");
    expect(id(resumeIndex("waChats"))).toBe("waChats");
    expect(id(resumeIndex(null))).toBe("welcome");
    expect(id(resumeIndex("removed-step"))).toBe("welcome");
  });

  it("counts the steps each user will see, without welcome/finish", () => {
    expect(countFor(owner)).toBeGreaterThan(countFor(viewer));
    expect(countFor(owner)).toBe(STEPS.filter((s) => s.advance !== "wait").length - 2);
  });

  it("has text for every step in both languages", async () => {
    for (const locale of ["id", "en"]) {
      const { tour } = (await import(`@/i18n/messages/${locale}.json`)).default;
      for (const s of STEPS.filter((s) => s.advance !== "wait")) { // "wait" steps show nothing
        expect(tour.steps[s.id]?.title, `${locale} ${s.id}`).toBeTruthy();
        if (s.close) expect(tour.steps[s.id].action, `${locale} ${s.id} action`).toBeTruthy();
      }
    }
  });
});
