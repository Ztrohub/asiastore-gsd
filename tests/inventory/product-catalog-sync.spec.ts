import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const putProduct = vi.fn();
const getProduct = vi.fn();
const addQueue = vi.fn();
const clearProducts = vi.fn();
const appMetaGet = vi.fn();
const appMetaPut = vi.fn();
const syncQueueToArray = vi.fn();
const transaction = vi.fn();
const productsToArray = vi.fn();

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    products: {
      get: getProduct,
      put: putProduct,
      clear: clearProducts,
      orderBy: () => ({ toArray: productsToArray }),
    },
    syncQueue: {
      add: addQueue,
      where: () => ({
        anyOf: () => ({
          toArray: syncQueueToArray,
        }),
      }),
    },
    appMeta: { get: appMetaGet, put: appMetaPut },
    transaction,
  },
}));

describe("product catalog offline-first sync contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addQueue.mockResolvedValue(1);
    getProduct.mockResolvedValue(undefined);
    productsToArray.mockResolvedValue([]);
    syncQueueToArray.mockResolvedValue([]);
    transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback === "function") {
        await callback();
      }
    });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
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
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_sell_in_large: true,
      special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    });

    const product = putProduct.mock.calls[0][0];
    const queueRow = addQueue.mock.calls[0][0];
    const queuedPayload = JSON.parse(queueRow.deltaPayload);

    expect(product).toHaveProperty("id_produk");
    expect(product).toHaveProperty("nama_produk", "Kopi Susu");
    expect(product).toHaveProperty("sku", "KOPI-001");
    expect(product).toHaveProperty("harga_jual", 15000);
    expect(product).toHaveProperty("harga_jual_unit_besar", 160000);
    expect(product).toHaveProperty("stok_saat_ini", 10);
    expect(product).toHaveProperty("stok_unit_besar_saat_ini", 4);
    expect(product).toHaveProperty("special_prices", [
      { unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 },
    ]);
    expect(queueRow.status).toBe("pending");
    expect(queueRow.entityType).toBe("inventory_product");
    expect(queuedPayload.special_prices).toEqual([
      { unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 },
    ]);
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

  it("sanitizes nullable server fields before queueing edited product sync", async () => {
    getProduct.mockResolvedValueOnce({
      id_produk: "1160b889-5bee-49d8-ada2-1625d52e27f2",
      nama_produk: "Test Barang",
      harga_jual: 50000,
      harga_jual_unit_besar: null,
      stok_saat_ini: 0,
      stok_unit_besar_saat_ini: 0,
      is_active: true,
      unit_small_name: "pcs",
      unit_large_name: null,
      unit_large_to_small: null,
      allow_buy_in_small: true,
      allow_buy_in_large: false,
      allow_sell_in_small: true,
      allow_sell_in_large: false,
      updatedAt: 1779864118447,
    });

    const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    await persistProductCatalog({
      id_produk: "1160b889-5bee-49d8-ada2-1625d52e27f2",
      nama_produk: "Test Barang",
      harga_jual: 50000,
      stok_saat_ini: 0,
      is_active: false,
      unit_small_name: "pcs",
      allow_buy_in_small: true,
      allow_buy_in_large: false,
      allow_sell_in_small: true,
      allow_sell_in_large: false,
    });

    const product = putProduct.mock.calls[0][0];
    const queueRow = addQueue.mock.calls[0][0];
    const queuedPayload = JSON.parse(queueRow.deltaPayload);

    expect(product.harga_jual_unit_besar).toBeUndefined();
    expect(product.unit_large_name).toBeUndefined();
    expect(product.unit_large_to_small).toBeUndefined();
    expect(queuedPayload).not.toHaveProperty("harga_jual_unit_besar");
    expect(queuedPayload).not.toHaveProperty("unit_large_name");
    expect(queuedPayload).not.toHaveProperty("unit_large_to_small");
  });

  it("clears marketplace metadata from local cache and sync payload when marketplace flag is disabled", async () => {
    getProduct.mockResolvedValueOnce({
      id_produk: "prod-marketplace",
      nama_produk: "Produk Marketplace",
      harga_jual: 50000,
      harga_jual_unit_besar: null,
      stok_saat_ini: 8,
      stok_unit_besar_saat_ini: 0,
      is_active: true,
      unit_small_name: "pcs",
      unit_large_name: null,
      unit_large_to_small: null,
      allow_buy_in_small: true,
      allow_buy_in_large: false,
      allow_sell_in_small: true,
      allow_sell_in_large: false,
      is_marketplace: true,
      marketplace_product_name: "Produk Marketplace Official",
      marketplace_product_id: "MP-001",
      marketplace_sku_id: "SKU-MP-001",
      updatedAt: 1779864118447,
    });

    const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    await persistProductCatalog({
      id_produk: "prod-marketplace",
      nama_produk: "Produk Marketplace",
      harga_jual: 50000,
      stok_saat_ini: 8,
      is_active: true,
      is_marketplace: false,
    } as never);

    const product = putProduct.mock.calls[0][0];
    const queueRow = addQueue.mock.calls[0][0];
    const queuedPayload = JSON.parse(queueRow.deltaPayload);

    expect(product.is_marketplace).toBe(false);
    expect(product.marketplace_product_name).toBeUndefined();
    expect(product.marketplace_product_id).toBeUndefined();
    expect(product.marketplace_sku_id).toBeUndefined();
    expect(queuedPayload.is_marketplace).toBe(false);
    expect(queuedPayload).not.toHaveProperty("marketplace_product_name");
    expect(queuedPayload).not.toHaveProperty("marketplace_product_id");
    expect(queuedPayload).not.toHaveProperty("marketplace_sku_id");
  });

  it("stores large-unit marketplace identifiers in local cache and queued sync payload", async () => {
    const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    await persistProductCatalog({
      nama_produk: "Produk Marketplace Besar",
      harga_jual: 50000,
      harga_jual_unit_besar: 540000,
      stok_saat_ini: 8,
      stok_unit_besar_saat_ini: 3,
      is_active: true,
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_buy_in_small: true,
      allow_buy_in_large: true,
      allow_sell_in_small: true,
      allow_sell_in_large: true,
      is_marketplace: true,
      marketplace_product_name: "Produk Marketplace Official",
      marketplace_sku_id: "SKU-MP-001",
      marketplace_large_sku_id: "SKU-MP-001-DUS",
    } as never);

    const product = putProduct.mock.calls[0][0];
    const queueRow = addQueue.mock.calls[0][0];
    const queuedPayload = JSON.parse(queueRow.deltaPayload);

    expect(product.marketplace_product_id).toBeUndefined();
    expect(product.marketplace_sku_id).toBe("SKU-MP-001");
    expect(product.marketplace_large_product_id).toBeUndefined();
    expect(product.marketplace_large_sku_id).toBe("SKU-MP-001-DUS");
    expect(queuedPayload).not.toHaveProperty("marketplace_product_id");
    expect(queuedPayload.marketplace_sku_id).toBe("SKU-MP-001");
    expect(queuedPayload).not.toHaveProperty("marketplace_large_product_id");
    expect(queuedPayload.marketplace_large_sku_id).toBe("SKU-MP-001-DUS");
  });

  it("stores package kind and recipe rows in local cache and queued sync payload", async () => {
    const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    await persistProductCatalog({
      nama_produk: "Paket A",
      sku: "PKT-A",
      harga_jual: 0,
      stok_saat_ini: 0,
      is_active: true,
      product_kind: "PACKAGE",
      is_marketplace: true,
      marketplace_product_name: "Paket A Marketplace",
      marketplace_sku_id: "SKU-PKT-A",
      package_items: [
        { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
        { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
      ],
    } as never);

    const saved = putProduct.mock.calls[0][0];
    const queued = JSON.parse(addQueue.mock.calls[0][0].deltaPayload);

    expect(saved.product_kind).toBe("PACKAGE");
    expect(saved.package_items).toEqual([
      { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
      { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
    ]);
    expect(queued.product_kind).toBe("PACKAGE");
    expect(queued.package_items).toEqual(saved.package_items);
  });

  it("keeps package rows visible after sync by deriving stock from component products", async () => {
    productsToArray.mockResolvedValueOnce([
      {
        id_produk: "prod-a",
        nama_produk: "Produk A",
        harga_jual: 10000,
        stok_saat_ini: 8,
        is_active: true,
        product_kind: "NORMAL",
        updatedAt: 1782896400000,
      },
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        harga_jual: 0,
        stok_saat_ini: 0,
        is_active: true,
        product_kind: "PACKAGE",
        package_items: [{ component_product_id: "prod-a", component_unit: "SMALL", component_qty: 2 }],
        updatedAt: 1782896400000,
      },
    ]);

    const { useProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    const { result } = renderHook(() => useProductCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products.find((item) => item.id_produk === "pkg-1")).toMatchObject({
      harga_jual: 20000,
      stok_saat_ini: 4,
      product_kind: "PACKAGE",
    });
  });

  it("preserves negative local stock on refresh so POS stockout stays visible", async () => {
    productsToArray.mockResolvedValueOnce([
      {
        id_produk: "prod-neg",
        nama_produk: "Produk Minus",
        sku: "NEG-001",
        harga_jual: 12000,
        stok_saat_ini: -3,
        stok_unit_besar_saat_ini: -1,
        is_active: true,
        unit_small_name: "pcs",
        unit_large_name: "dus",
        unit_large_to_small: 12,
        allow_buy_in_small: true,
        allow_buy_in_large: true,
        allow_sell_in_small: true,
        allow_sell_in_large: true,
        updatedAt: 1779946036531,
      },
    ]);

    const { useProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    const { result } = renderHook(() => useProductCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0]).toEqual(
      expect.objectContaining({
        stok_saat_ini: -3,
        stok_unit_besar_saat_ini: -1,
      }),
    );
  });

  it("still imports server stock when browser online flag is stale-false", async () => {
    let productState: Array<{
      id_produk: string;
      nama_produk: string;
      sku?: string;
      harga_jual: number;
      stok_saat_ini: number;
      stok_unit_besar_saat_ini?: number;
      is_active: boolean;
      updatedAt: number;
      unit_small_name?: string;
      unit_large_name?: string;
      unit_large_to_small?: number;
      allow_buy_in_small?: boolean;
      allow_buy_in_large?: boolean;
      allow_sell_in_small?: boolean;
      allow_sell_in_large?: boolean;
    }> = [];

    productsToArray.mockImplementation(async () => [...productState]);
    putProduct.mockImplementation(async (product: (typeof productState)[number]) => {
      productState = productState.filter((item) => item.id_produk !== product.id_produk).concat(product);
    });

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        cursor: "1779947000000:prod-remote",
        products: [
          {
            id_produk: "prod-remote",
            nama_produk: "Produk Remote",
            sku: "SKU-REMOTE",
            harga_jual: 21000,
            stok_saat_ini: 9,
            stok_unit_besar_saat_ini: 0,
            is_active: true,
            unit_small_name: "pcs",
            updatedAt: "2026-06-10T05:58:38.018Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    const { result } = renderHook(() => useProductCatalog());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/inventory/products", { cache: "no-store" });
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.products).toHaveLength(1);
    });

    expect(result.current.products[0]).toEqual(
      expect.objectContaining({
        id_produk: "prod-remote",
        stok_saat_ini: 9,
      }),
    );
  });

  it("keeps local products when incremental sync returns an empty page", async () => {
    const localProducts = [
      {
        id_produk: "prod-1",
        nama_produk: "Produk Satu",
        sku: "SKU-1",
        harga_jual: 12000,
        stok_saat_ini: 4,
        is_active: true,
        updatedAt: 1779946036531,
      },
      {
        id_produk: "prod-2",
        nama_produk: "Produk Dua",
        sku: "SKU-2",
        harga_jual: 15000,
        stok_saat_ini: 7,
        is_active: true,
        updatedAt: 1779946041640,
      },
    ];
    let productState = [...localProducts];
    const cursorValue = "1779946041640:prod-2";

    appMetaGet.mockImplementation(async (key: string) => {
      if (key === "inventory_products_last_sync_cursor") {
        return { key, value: cursorValue };
      }
      return undefined;
    });
    appMetaPut.mockImplementation(async ({ key, value }: { key: string; value: string }) => ({
      key,
      value,
    }));
    clearProducts.mockImplementation(async () => {
      productState = [];
    });
    putProduct.mockImplementation(async (product: (typeof localProducts)[number]) => {
      productState = productState.filter((item) => item.id_produk !== product.id_produk).concat(product);
    });
    productsToArray.mockImplementation(async () => [...productState]);

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, products: [], cursor: cursorValue }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    const { result } = renderHook(() => useProductCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/inventory/products?cursor=${encodeURIComponent(cursorValue)}`,
        { cache: "no-store" },
      );
    });
    await waitFor(() => {
      expect(result.current.products).toHaveLength(2);
    });

    expect(productState).toHaveLength(2);
    expect(clearProducts).not.toHaveBeenCalled();
  });

  it("keeps server special price arrays when syncing product rows into the offline cache", async () => {
    let productState: Array<{
      id_produk: string;
      nama_produk: string;
      harga_jual: number;
      stok_saat_ini: number;
      is_active: boolean;
      updatedAt: number;
      special_prices?: Array<{ unit_mutasi: "SMALL" | "LARGE"; qty_tenths: number; harga: number }>;
    }> = [];

    productsToArray.mockImplementation(async () => [...productState]);
    putProduct.mockImplementation(async (product: (typeof productState)[number]) => {
      productState = productState.filter((item) => item.id_produk !== product.id_produk).concat(product);
    });

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        cursor: "1779947000000:prod-remote",
        products: [
          {
            id_produk: "prod-remote",
            nama_produk: "Produk Remote",
            harga_jual: 21000,
            stok_saat_ini: 9,
            is_active: true,
            unit_small_name: "pcs",
            special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
            updatedAt: "2026-06-10T05:58:38.018Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
    const { result } = renderHook(() => useProductCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.products).toHaveLength(1);
    });

    expect(result.current.products[0]).toEqual(
      expect.objectContaining({
        id_produk: "prod-remote",
        special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
      }),
    );
  });
});
