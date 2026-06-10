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
});
