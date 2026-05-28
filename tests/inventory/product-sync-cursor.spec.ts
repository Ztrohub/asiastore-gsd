import { describe, expect, it } from "vitest";
import {
  buildProductCursorQuery,
  compareProductSyncCursor,
  maxProductSyncCursor,
  parseProductSyncCursor,
  serializeProductSyncCursor,
} from "@/lib/sync/product-sync-cursor";

describe("product sync cursor helpers", () => {
  it("builds product sync requests from the exact stored cursor without overlap subtraction", () => {
    expect(buildProductCursorQuery()).toBe("/api/inventory/products");
    expect(buildProductCursorQuery("1779000000000:prod-a")).toBe(
      "/api/inventory/products?cursor=1779000000000%3Aprod-a",
    );
  });

  it("orders same-timestamp cursors by product id so later rows are not repeated or skipped", () => {
    const first = parseProductSyncCursor("1779000000000:prod-a");
    const second = parseProductSyncCursor("1779000000000:prod-b");

    expect(compareProductSyncCursor(first, second)).toBeLessThan(0);
    expect(serializeProductSyncCursor(maxProductSyncCursor(first, second))).toBe(
      "1779000000000:prod-b",
    );
  });

  it("keeps legacy numeric cursors readable while normalizing the timestamp", () => {
    expect(parseProductSyncCursor("1779000000000")).toEqual({
      timestamp: 1779000000000,
      id_produk: "",
    });
  });
});
