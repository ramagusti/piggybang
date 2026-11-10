import { describe, expect, it } from "vitest";
import { formatMoney, parseAmount, toLocalInput } from "./format";

describe("formatMoney", () => {
  it("formats rupiah with dot thousands", () => {
    expect(formatMoney(25000)).toBe("Rp 25.000");
    expect(formatMoney("168134.00")).toBe("Rp 168.134");
  });
  it("compacts juta and miliar", () => {
    expect(formatMoney(4500000, { compact: true })).toBe("Rp 4,5 JT");
    expect(formatMoney(16000000, { compact: true })).toBe("Rp 16 JT");
    expect(formatMoney(1_200_000_000, { compact: true })).toBe("Rp 1,2 M");
    expect(formatMoney(385344, { compact: true })).toBe("Rp 385.344");
  });
  it("handles negative and signed values", () => {
    expect(formatMoney(-89491625, { compact: true })).toBe("-Rp 89,5 JT");
    expect(formatMoney(25000, { sign: true })).toBe("+Rp 25.000");
    expect(formatMoney(0, { sign: true })).toBe("Rp 0");
  });
  it("supports international style and other currencies", () => {
    expect(formatMoney(1234567, { style: "intl" })).toBe("IDR 1,234,567");
    expect(formatMoney(12.5, { currency: "USD", style: "intl" })).toBe("$12.50");
  });
  it("treats garbage as zero", () => {
    expect(formatMoney(null)).toBe("Rp 0");
    expect(formatMoney("abc")).toBe("Rp 0");
  });
});

describe("parseAmount", () => {
  it("keeps digits only", () => {
    expect(parseAmount("25.000")).toBe(25000);
    expect(parseAmount("Rp 1.234.567")).toBe(1234567);
    expect(parseAmount("")).toBeNull();
  });
});

describe("toLocalInput", () => {
  it("produces datetime-local value", () => {
    expect(toLocalInput(new Date(2026, 7, 6, 12, 30))).toBe("2026-08-06T12:30");
  });
});
