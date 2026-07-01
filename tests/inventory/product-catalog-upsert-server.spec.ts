import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const upsert = vi.fn();
const update = vi.fn();
const create = vi.fn();
const deleteMany = vi.fn();
const createMany = vi.fn();
const deleteManyPackageItems = vi.fn();
const createManyPackageItems = vi.fn();
const transaction = vi.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
  callback({
    product: {
      findMany,
      findUnique,
      upsert,
      update,
      create,
    },
    productSpecialPrice: {
      deleteMany,
      createMany,
    },
    productPackageItem: {
      deleteMany: deleteManyPackageItems,
      createMany: createManyPackageItems,
    },
  }),
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transaction,
    product: {
      findMany,
      findUnique,
      upsert,
      update,
      create,
    },
    productSpecialPrice: {
      deleteMany,
      createMany,
    },
    productPackageItem: {
      deleteMany: deleteManyPackageItems,
      createMany: createManyPackageItems,
    },
  },
}));

describe("server product upsert conflict handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMany.mockResolvedValue({ count: 0 });
    createMany.mockResolvedValue({ count: 0 });
    deleteManyPackageItems.mockResolvedValue({ count: 0 });
    createManyPackageItems.mockResolvedValue({ count: 0 });
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
      marketplace_large_product_id: "MP-EXISTING-DUS",
      marketplace_large_sku_id: "SKU-MP-EXISTING-DUS",
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
          marketplace_large_product_id: "MP-EXISTING-DUS",
          marketplace_large_sku_id: "SKU-MP-EXISTING-DUS",
        }),
      }),
    );
  });

  it("stores dedicated large-unit marketplace identifiers when provided by sync payload", async () => {
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
      harga_jual_unit_besar: 240000,
      stok_saat_ini: 6,
      stok_unit_besar_saat_ini: 2,
      is_active: true,
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_buy_in_small: true,
      allow_buy_in_large: true,
      allow_sell_in_small: true,
      allow_sell_in_large: true,
      is_marketplace: true,
      marketplace_product_id: "MP-SMALL",
      marketplace_sku_id: "SKU-SMALL",
      marketplace_large_product_id: "MP-LARGE",
      marketplace_large_sku_id: "SKU-LARGE",
    } as never);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          marketplace_product_id: "MP-EXISTING",
          marketplace_sku_id: "SKU-SMALL",
          marketplace_large_product_id: "MP-LARGE",
          marketplace_large_sku_id: "SKU-LARGE",
        }),
      }),
    );
  });

  it("preserves deprecated marketplace product ids from existing records instead of replacing them", async () => {
    findUnique.mockResolvedValueOnce({
      id_produk: "prod-marketplace",
      last_synced_at: null,
      is_marketplace: true,
      marketplace_product_name: "Produk Marketplace Existing",
      marketplace_product_id: "MP-EXISTING",
      marketplace_sku_id: "SKU-EXISTING",
      marketplace_large_product_id: "MP-EXISTING-DUS",
      marketplace_large_sku_id: "SKU-EXISTING-DUS",
    });
    upsert.mockResolvedValue({ id_produk: "prod-marketplace" });

    const { upsertProduct } = await import("@/lib/db/product-catalog");
    await upsertProduct({
      id_produk: "prod-marketplace",
      nama_produk: "Produk Marketplace",
      harga_jual: 22000,
      harga_jual_unit_besar: 240000,
      stok_saat_ini: 6,
      stok_unit_besar_saat_ini: 2,
      is_active: true,
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_buy_in_small: true,
      allow_buy_in_large: true,
      allow_sell_in_small: true,
      allow_sell_in_large: true,
      is_marketplace: true,
      marketplace_product_name: "Produk Marketplace Baru",
      marketplace_product_id: "MP-NEW",
      marketplace_sku_id: "SKU-NEW",
      marketplace_large_product_id: "MP-NEW-DUS",
      marketplace_large_sku_id: "SKU-NEW-DUS",
    } as never);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          marketplace_product_id: "MP-EXISTING",
          marketplace_sku_id: "SKU-NEW",
          marketplace_large_product_id: "MP-EXISTING-DUS",
          marketplace_large_sku_id: "SKU-NEW-DUS",
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

  it("replaces package recipe rows transactionally when a package product is upserted", async () => {
    findUnique.mockResolvedValueOnce({
      id_produk: "pkg-1",
      last_synced_at: null,
      is_marketplace: false,
      product_kind: "PACKAGE",
      marketplace_product_name: null,
      marketplace_product_id: null,
      marketplace_sku_id: null,
      marketplace_large_product_id: null,
      marketplace_large_sku_id: null,
    });
    upsert.mockResolvedValue({ id_produk: "pkg-1" });

    deleteManyPackageItems.mockResolvedValue({ count: 2 });
    createManyPackageItems.mockResolvedValue({ count: 2 });
    transaction.mockImplementation(async (callback: (trx: unknown) => Promise<unknown>) =>
      callback({
        product: {
          findMany,
          findUnique,
          upsert,
          update,
          create,
        },
        productSpecialPrice: {
          deleteMany,
          createMany,
        },
        productPackageItem: {
          deleteMany: deleteManyPackageItems,
          createMany: createManyPackageItems,
        },
      }),
    );

    const { upsertProduct } = await import("@/lib/db/product-catalog");
    await upsertProduct({
      id_produk: "pkg-1",
      nama_produk: "Paket A",
      harga_jual: 0,
      stok_saat_ini: 0,
      is_active: true,
      product_kind: "PACKAGE",
      package_items: [
        { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
        { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
      ],
    } as never);

    expect(deleteManyPackageItems).toHaveBeenCalledWith({
      where: { package_product_id: "pkg-1" },
    });
    expect(createManyPackageItems).toHaveBeenCalledWith({
      data: [
        {
          package_product_id: "pkg-1",
          component_product_id: "prod-a",
          component_unit: "SMALL",
          component_qty: 1,
        },
        {
          package_product_id: "pkg-1",
          component_product_id: "prod-b",
          component_unit: "LARGE",
          component_qty: 2,
        },
      ],
    });
  });
});
