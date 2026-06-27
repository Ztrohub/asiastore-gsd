import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
const decodeSessionMock = vi.fn();
const findUserMock = vi.fn();
const upsertProductMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/auth/server-session", () => ({
  SESSION_COOKIE_NAME: "asiatek-session",
  decodeSession: decodeSessionMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUserMock,
    },
  },
}));

vi.mock("@/lib/db/product-catalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/product-catalog")>(
    "@/lib/db/product-catalog",
  );

  return {
    ...actual,
    upsertProduct: upsertProductMock,
  };
});

describe("inventory product route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === "asiatek-session" ? { value: "token-1" } : undefined),
    });
    decodeSessionMock.mockReturnValue({
      userId: "user-1",
      role: "OWNER",
      passwordVersion: 1,
    });
    findUserMock.mockResolvedValue({
      id: "user-1",
      isActive: true,
      role: "OWNER",
      passwordVersion: 1,
    });
    upsertProductMock.mockResolvedValue({ id_produk: "prod-neg" });
  });

  it("accepts negative large-unit stock payloads when business policy allows minus stock", async () => {
    const { POST } = await import("@/app/api/inventory/products/route");

    const request = new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            id_produk: "prod-neg",
            nama_produk: "Produk Minus",
            harga_jual: 12000,
            harga_jual_unit_besar: 120000,
            stok_saat_ini: -4,
            stok_unit_besar_saat_ini: -1,
            is_active: true,
            unit_small_name: "pcs",
            unit_large_name: "dus",
            unit_large_to_small: 12,
            allow_buy_in_small: true,
            allow_buy_in_large: true,
            allow_sell_in_small: true,
            allow_sell_in_large: true,
            updatedAt: 1781070002000,
          },
        ],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, count: 1 });
    expect(upsertProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id_produk: "prod-neg",
        stok_saat_ini: -4,
        stok_unit_besar_saat_ini: -1,
      }),
    );
  });

  it("persists marketplace metadata when marketplace flag is enabled", async () => {
    const { POST } = await import("@/app/api/inventory/products/route");

    const request = new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            id_produk: "prod-marketplace",
            nama_produk: "Produk Marketplace",
            harga_jual: 25000,
            stok_saat_ini: 3,
            is_active: true,
            unit_small_name: "pcs",
            allow_buy_in_small: true,
            allow_buy_in_large: false,
            allow_sell_in_small: true,
            allow_sell_in_large: false,
            is_marketplace: true,
            marketplace_product_name: "Produk Marketplace Tokopedia",
            marketplace_product_id: "MP-001",
            marketplace_sku_id: "SKU-MP-001",
            updatedAt: 1781070003000,
          },
        ],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, count: 1 });
    expect(upsertProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id_produk: "prod-marketplace",
        is_marketplace: true,
        marketplace_product_name: "Produk Marketplace Tokopedia",
        marketplace_product_id: "MP-001",
        marketplace_sku_id: "SKU-MP-001",
      }),
    );
  });

  it("persists dedicated large-unit marketplace identifiers when provided", async () => {
    const { POST } = await import("@/app/api/inventory/products/route");

    const request = new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            id_produk: "prod-marketplace-large",
            nama_produk: "Produk Marketplace Besar",
            harga_jual: 25000,
            harga_jual_unit_besar: 250000,
            stok_saat_ini: 12,
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
            marketplace_product_name: "Produk Marketplace Tokopedia",
            marketplace_product_id: "MP-001",
            marketplace_sku_id: "SKU-MP-001",
            marketplace_large_product_id: "MP-001-DUS",
            marketplace_large_sku_id: "SKU-MP-001-DUS",
            updatedAt: 1781070003000,
          },
        ],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, count: 1 });
    expect(upsertProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id_produk: "prod-marketplace-large",
        is_marketplace: true,
        marketplace_product_id: "MP-001",
        marketplace_sku_id: "SKU-MP-001",
        marketplace_large_product_id: "MP-001-DUS",
        marketplace_large_sku_id: "SKU-MP-001-DUS",
      }),
    );
  });

  it("rejects marketplace payloads when required marketplace identifiers are missing", async () => {
    const { POST } = await import("@/app/api/inventory/products/route");

    const request = new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            id_produk: "prod-marketplace",
            nama_produk: "Produk Marketplace",
            harga_jual: 25000,
            stok_saat_ini: 3,
            is_active: true,
            unit_small_name: "pcs",
            allow_buy_in_small: true,
            allow_buy_in_large: false,
            allow_sell_in_small: true,
            allow_sell_in_large: false,
            is_marketplace: true,
            marketplace_product_name: "Produk Marketplace Tokopedia",
            marketplace_product_id: "",
            marketplace_sku_id: "SKU-MP-001",
            updatedAt: 1781070003000,
          },
        ],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, message: "Payload produk tidak valid." });
    expect(upsertProductMock).not.toHaveBeenCalled();
  });

  it("accepts special price rules and forwards them to the product catalog upsert", async () => {
    const { POST } = await import("@/app/api/inventory/products/route");

    const request = new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            id_produk: "prod-special",
            nama_produk: "Produk Special",
            harga_jual: 10000,
            stok_saat_ini: 4,
            is_active: true,
            unit_small_name: "pcs",
            allow_buy_in_small: true,
            allow_buy_in_large: false,
            allow_sell_in_small: true,
            allow_sell_in_large: false,
            special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
            updatedAt: 1781070003000,
          },
        ],
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(upsertProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
      }),
    );
  });

  it("rejects duplicate special price rules for the same unit and qty", async () => {
    const { POST } = await import("@/app/api/inventory/products/route");

    const request = new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            id_produk: "prod-special",
            nama_produk: "Produk Special",
            harga_jual: 10000,
            stok_saat_ini: 4,
            is_active: true,
            unit_small_name: "pcs",
            allow_buy_in_small: true,
            allow_buy_in_large: false,
            allow_sell_in_small: true,
            allow_sell_in_large: false,
            special_prices: [
              { unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 },
              { unit_mutasi: "SMALL", qty_tenths: 5, harga: 6200 },
            ],
            updatedAt: 1781070003000,
          },
        ],
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(400);
    expect(upsertProductMock).not.toHaveBeenCalled();
  });
});
