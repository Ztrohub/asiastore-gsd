import { describe, expect, it } from "vitest";
import { normalizeUpdatedAt } from "@/features/inventory/hooks/use-product-catalog";

describe("normalizeUpdatedAt", () => {
  it("returns numeric epoch when given number", () => {
    expect(normalizeUpdatedAt(1700000000000)).toBe(1700000000000);
  });

  it("parses ISO date string into epoch", () => {
    expect(normalizeUpdatedAt("2026-05-18T00:00:00.000Z")).toBe(1779062400000);
  });

  it("falls back to now for invalid values", () => {
    const value = normalizeUpdatedAt("invalid-date");
    expect(typeof value).toBe("number");
    expect(Number.isFinite(value)).toBe(true);
  });
});
