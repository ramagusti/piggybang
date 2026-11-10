import { describe, expect, it } from "vitest";
import { evaluate, isExpression } from "./calc";

describe("evaluate", () => {
  it.each([
    ["25rb+15rb*2", 55000],
    ["300000/3", 100000],
    ["300.000 : 3", 100000],
    ["1,5jt", 1500000],
    ["1.5jt", 1500000],
    ["25.000 x 3", 75000],
    ["(10+5)*2k", 30000],
    ["100k - 12.500", 87500],
    ["-5000+10000", 5000],
    ["25.000", 25000],
  ])("%s = %d", (input, out) => expect(evaluate(input)).toBe(out));

  it.each(["", "abc", "10/0", "(1+2", "5++", "2*(3"])("rejects %s", (input) => expect(evaluate(input)).toBeNull());

  it("detects expressions", () => {
    expect(isExpression("25000")).toBe(false);
    expect(isExpression("25.000")).toBe(false);
    expect(isExpression("25rb+5rb")).toBe(true);
  });
});
