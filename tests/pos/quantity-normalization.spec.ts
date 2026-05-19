import { describe, expect, it } from "vitest";
import {
  formatQuantityForDisplay,
  normalizeQuantityInput,
  truncateQuantityToSingleDecimal,
} from "@/lib/inventory/quantity";

describe("quantity normalization", () => {
  it("accepts dot and comma decimal input", () => {
    expect(normalizeQuantityInput("1.5")).toBe(1.5);
    expect(normalizeQuantityInput("1,5")).toBe(1.5);
  });

  it("truncates to one decimal place", () => {
    expect(truncateQuantityToSingleDecimal(1.29)).toBe(1.2);
    expect(normalizeQuantityInput("2,99")).toBe(2.9);
  });

  it("rejects non-positive values", () => {
    expect(() => normalizeQuantityInput("0")).toThrow("Qty harus lebih dari 0.");
    expect(() => normalizeQuantityInput("-1")).toThrow("Qty harus lebih dari 0.");
  });

  it("formats display with at most one decimal", () => {
    expect(formatQuantityForDisplay(2)).toBe("2");
    expect(formatQuantityForDisplay(2.56)).toBe("2,5");
  });
});
