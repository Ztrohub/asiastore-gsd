"use client";

import { useDeferredValue, useMemo } from "react";
import { formatCurrencyIdr } from "@/features/format/currency";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductRecord } from "@/lib/offline/db";
import { formatQuantityForDisplay } from "@/lib/inventory/quantity";
import { getLargeUnitName, getSmallUnitName } from "@/lib/inventory/uom";
import {
  createProductSearch,
  getProductMatchIndices,
  highlightMatchedText,
} from "@/lib/search/product-fuzzy-search";

type Props = {
  products: ProductRecord[];
  query: string;
  onEdit: (product: ProductRecord) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function ProductTable({ products, query, onEdit, emptyTitle, emptyDescription }: Props) {
  const deferredQuery = useDeferredValue(query);
  const searchProducts = useMemo(() => createProductSearch(products), [products]);
  const filtered = useMemo(() => searchProducts(deferredQuery), [deferredQuery, searchProducts]);
  const hasQuery = deferredQuery.trim().length > 0;

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {hasQuery ? "Produk tidak ditemukan" : (emptyTitle ?? "Belum ada produk")}
        </p>
        <p className="mt-1">
          {hasQuery
            ? "Coba kata kunci lain atau ubah filter yang aktif."
            : (emptyDescription ?? "Tambah produk pertama untuk mulai transaksi inventory.")}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama produk</TableHead>
          <TableHead>Harga jual</TableHead>
          <TableHead>Stok saat ini</TableHead>
          <TableHead>Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((result) => (
          <TableRow key={result.product.id_produk}>
            <TableCell>
              {highlightMatchedText(
                result.product.nama_produk,
                getProductMatchIndices(result.matches, "nama_produk"),
              )}
            </TableCell>
            <TableCell>
              <PriceCell product={result.product} />
            </TableCell>
            <TableCell>
              <StockCell product={result.product} />
            </TableCell>
            <TableCell>
              <Button onClick={() => onEdit(result.product)} size="sm" variant="outline">
                Edit
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PriceCell({ product }: { product: ProductRecord }) {
  const smallUnit = getSmallUnitName(product);
  const largeUnit = getLargeUnitName(product);
  return (
    <div>
      <p>
        {formatCurrencyIdr(product.harga_jual)} / {smallUnit}
      </p>
      {largeUnit ? (
        <p className="text-xs text-muted-foreground">
          {formatCurrencyIdr(product.harga_jual_unit_besar ?? product.harga_jual)} / {largeUnit}
        </p>
      ) : null}
    </div>
  );
}

function StockCell({ product }: { product: ProductRecord }) {
  const smallUnit = getSmallUnitName(product);
  const largeUnit = getLargeUnitName(product);
  const smallStock = formatQuantityForDisplay(product.stok_saat_ini);
  const largeStock = formatQuantityForDisplay(product.stok_unit_besar_saat_ini ?? 0);

  return (
    <div>
      <p>
        {smallStock} {smallUnit}
      </p>
      {largeUnit ? (
        <p className="text-xs text-muted-foreground">
          {largeStock} {largeUnit}
        </p>
      ) : null}
    </div>
  );
}
