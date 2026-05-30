import { render, screen } from "@testing-library/react";
import { Fragment, createElement } from "react";
import { describe, expect, it } from "vitest";
import { createProductSearch, highlightMatchedText } from "@/lib/search/product-fuzzy-search";
import type { ProductRecord } from "@/lib/offline/db";

const products: ProductRecord[] = [
  {
    id_produk: "p-1",
    nama_produk: "Kopi Tubruk",
    sku: "KOPI-001",
    harga_jual: 15000,
    stok_saat_ini: 10,
    is_active: true,
    updatedAt: Date.now(),
  },
  {
    id_produk: "p-2",
    nama_produk: "Teh Tarik",
    sku: "TEH-001",
    harga_jual: 12000,
    stok_saat_ini: 9,
    is_active: true,
    updatedAt: Date.now(),
  },
  {
    id_produk: "p-3",
    nama_produk: "Kopi Susu",
    sku: "KOPI-002",
    harga_jual: 17000,
    stok_saat_ini: 8,
    is_active: true,
    updatedAt: Date.now(),
  },
];

describe("product fuzzy search", () => {
  it("ranks the closest product name first for typo-tolerant queries", () => {
    const search = createProductSearch(products);

    const results = search("kopi tbruk");

    expect(results[0]?.product.nama_produk).toBe("Kopi Tubruk");
    expect(results[0]?.score).toBeLessThanOrEqual(results[1]?.score ?? Number.POSITIVE_INFINITY);
  });

  it("matches product names even when words are typed out of order", () => {
    const search = createProductSearch(products);

    const results = search("susu kopi");

    expect(results[0]?.product.nama_produk).toBe("Kopi Susu");
  });

  it("keeps exact sku matches discoverable without outranking a closer product-name hit", () => {
    const search = createProductSearch(products);

    const results = search("kopi 002");

    expect(results.slice(0, 2).map((item) => item.product.nama_produk)).toEqual([
      "Kopi Susu",
      "Kopi Tubruk",
    ]);
  });

  it("returns product-name match indices so the UI can highlight bold segments", () => {
    const search = createProductSearch(products);

    const results = search("tbruk");
    const nameMatch = results[0]?.matches.find((match) => match.key === "nama_produk");

    expect(results[0]?.product.nama_produk).toBe("Kopi Tubruk");
    expect(nameMatch?.indices.length).toBeGreaterThan(0);
  });

  it("renders highlighted segments with a much stronger visual emphasis", () => {
    render(createElement(Fragment, null, highlightMatchedText("Kopi Susu", [[0, 3]])));

    const highlighted = screen.getByText("Kopi");

    expect(highlighted.tagName).toBe("STRONG");
    expect(highlighted).toHaveClass("font-black");
    expect(highlighted).not.toHaveClass("underline");
  });
});
