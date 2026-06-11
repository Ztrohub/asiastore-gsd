import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const upsert = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    product: {
      findMany,
      findUnique,
      upsert,
      update,
      create,
    },
  },
}));

describe("server product upsert conflict handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to existing server product id when incoming id differs but sku already exists", async () => {
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id_produk: "server-prod-1", last_synced_at: null });
    upsert.mockResolvedValue({ id_produk: "server-prod-1" });

    const { upsertProduct } = await import("@/lib/db/product-catalog");
    await upsertProduct({
      id_produk: "device-prod-1",
      nama_produk: "Produk A",
      sku: "SKU-001",
      harga_jual: 12000,
      stok_saat_ini: 4,
      is_active: true,
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_produk: "server-prod-1" },
        create: expect.objectContaining({ id_produk: "server-prod-1", sku: "SKU-001" }),
      }),
    );
  });

  it("throws explicit conflict when a different product id already uses the requested sku", async () => {
    findUnique
      .mockResolvedValueOnce({ id_produk: "prod-a", last_synced_at: null })
      .mockResolvedValueOnce({ id_produk: "prod-b", last_synced_at: null });

    const { ProductCatalogConflictError, upsertProduct } = await import("@/lib/db/product-catalog");
    await expect(
      upsertProduct({
        id_produk: "prod-a",
        nama_produk: "Produk A",
        sku: "SKU-001",
        harga_jual: 15000,
        stok_saat_ini: 7,
        is_active: true,
      }),
    ).rejects.toBeInstanceOf(ProductCatalogConflictError);
  });

  it("updates existing product by sku when payload has no id_produk", async () => {
    findUnique.mockResolvedValueOnce({ id_produk: "server-prod-2", last_synced_at: null });
    update.mockResolvedValue({ id_produk: "server-prod-2" });

    const { upsertProduct } = await import("@/lib/db/product-catalog");
    await upsertProduct({
      nama_produk: "Produk B",
      sku: "SKU-002",
      harga_jual: 13000,
      stok_saat_ini: 5,
      is_active: true,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_produk: "server-prod-2" },
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("preserves existing marketplace metadata when legacy payload omits marketplace fields", async () => {
    findUnique.mockResolvedValueOnce({
      id_produk: "prod-marketplace",
      last_synced_at: null,
      is_marketplace: true,
      marketplace_product_name: "Produk Marketplace Existing",
      marketplace_product_id: "MP-EXISTING",
      marketplace_sku_id: "SKU-MP-EXISTING",
    });
    upsert.mockResolvedValue({ id_produk: "prod-marketplace" });

    const { upsertProduct } = await import("@/lib/db/product-catalog");
    await upsertProduct({
      id_produk: "prod-marketplace",
      nama_produk: "Produk Marketplace",
      harga_jual: 22000,
      stok_saat_ini: 6,
      is_active: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          is_marketplace: true,
          marketplace_product_name: "Produk Marketplace Existing",
          marketplace_product_id: "MP-EXISTING",
          marketplace_sku_id: "SKU-MP-EXISTING",
        }),
      }),
    );
  });

  it("clears marketplace metadata when payload explicitly disables marketplace sale", async () => {
    findUnique.mockResolvedValueOnce({
      id_produk: "prod-marketplace",
      last_synced_at: null,
      is_marketplace: true,
      marketplace_product_name: "Produk Marketplace Existing",
      marketplace_product_id: "MP-EXISTING",
      marketplace_sku_id: "SKU-MP-EXISTING",
    });
    upsert.mockResolvedValue({ id_produk: "prod-marketplace" });

    const { upsertProduct } = await import("@/lib/db/product-catalog");
    await upsertProduct({
      id_produk: "prod-marketplace",
      nama_produk: "Produk Marketplace",
      harga_jual: 22000,
      stok_saat_ini: 6,
      is_active: true,
      is_marketplace: false,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          is_marketplace: false,
          marketplace_product_name: null,
          marketplace_product_id: null,
          marketplace_sku_id: null,
        }),
      }),
    );
  });

  it("lists products incrementally by updatedAfterMs when cursor is provided", async () => {
    findMany.mockResolvedValue([]);

    const { listProducts } = await import("@/lib/db/product-catalog");
    await listProducts({ updatedAfterMs: 1779000000000 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { createdAt: { gte: new Date(1779000000000) } },
            { updatedAt: { gte: new Date(1779000000000) } },
            { last_synced_at: { gte: new Date(1779000000000) } },
          ],
        },
      }),
    );
  });

  it("uses the latest product change timestamp across created, updated, and synced times", async () => {
    const { getProductChangeTime } = await import("@/lib/db/product-catalog");

    expect(
      getProductChangeTime({
        createdAt: new Date(1779000000000),
        updatedAt: new Date(1779000001000),
        last_synced_at: new Date(1779000005000),
      }),
    ).toBe(1779000005000);
  });

  it("lists full products when cursor is not provided", async () => {
    findMany.mockResolvedValue([]);

    const { listProducts } = await import("@/lib/db/product-catalog");
    await listProducts();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it("filters out already-consumed rows when the cursor includes the last processed product id", async () => {
    const cursorTimestamp = 1779000005000;
    findMany.mockResolvedValue([
      {
        id_produk: "prod-a",
        nama_produk: "Produk A",
        createdAt: new Date(cursorTimestamp),
        updatedAt: new Date(cursorTimestamp),
        last_synced_at: null,
      },
      {
        id_produk: "prod-b",
        nama_produk: "Produk B",
        createdAt: new Date(cursorTimestamp),
        updatedAt: new Date(cursorTimestamp),
        last_synced_at: null,
      },
      {
        id_produk: "prod-c",
        nama_produk: "Produk C",
        createdAt: new Date(cursorTimestamp + 10),
        updatedAt: new Date(cursorTimestamp + 10),
        last_synced_at: null,
      },
    ]);

    const { listProducts } = await import("@/lib/db/product-catalog");
    const rows = await listProducts({
      cursor: `${cursorTimestamp}:prod-a`,
    } as never);

    expect(rows.map((row) => row.id_produk)).toEqual(["prod-b", "prod-c"]);
  });
});
