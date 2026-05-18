import { describe, expect, it } from "vitest";
import { parseRawPrice } from "@/features/inventory/hooks/use-product-price-input";

describe("product price input contract", () => {
  it("parses raw digits from mixed input", () => {
    expect(parseRawPrice("15.000")).toBe(15000);
    expect(parseRawPrice("Rp20.500")).toBe(20500);
  });

  it("drops decimal marker and keeps integer-only value", () => {
    expect(parseRawPrice("12000.5")).toBe(120005);
  });
});
