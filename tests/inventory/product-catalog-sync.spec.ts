import { beforeEach, describe, expect, it, vi } from "vitest";

const putProduct = vi.fn();
const addQueue = vi.fn();

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    products: { put: putProduct, orderBy: () => ({ toArray: async () => [] }) },
    syncQueue: { add: addQueue },
    transaction: vi.fn(),
  },
}));

describe("product catalog offline-first sync contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes product locally and enqueues pending inventory_product sync row", async () => {
    const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    await persistProductCatalog({
      nama_produk: "Kopi Susu",
      sku: "KOPI-001",
      harga_jual: 15000,
      harga_jual_unit_besar: 160000,
      stok_saat_ini: 10,
      stok_unit_besar_saat_ini: 4,
    });

    const product = putProduct.mock.calls[0][0];
    const queueRow = addQueue.mock.calls[0][0];

    expect(product).toHaveProperty("id_produk");
    expect(product).toHaveProperty("nama_produk", "Kopi Susu");
    expect(product).toHaveProperty("sku", "KOPI-001");
    expect(product).toHaveProperty("harga_jual", 15000);
    expect(product).toHaveProperty("harga_jual_unit_besar", 160000);
    expect(product).toHaveProperty("stok_saat_ini", 10);
    expect(product).toHaveProperty("stok_unit_besar_saat_ini", 4);
    expect(queueRow.status).toBe("pending");
    expect(queueRow.entityType).toBe("inventory_product");
  });

  it("keeps integer-only price storage by rejecting decimal values", async () => {
    const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    await expect(
      persistProductCatalog({
        nama_produk: "Teh Tarik",
        harga_jual: 12000.5,
        stok_saat_ini: 4,
      }),
    ).rejects.toThrow("Harga jual harus bilangan bulat.");
  });
});
