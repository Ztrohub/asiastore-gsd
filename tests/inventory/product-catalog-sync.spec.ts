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
});
