"use client";

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
import { getLargeUnitName, getSmallUnitName } from "@/lib/inventory/uom";

type Props = {
  products: ProductRecord[];
  query: string;
  onEdit: (product: ProductRecord) => void;
};

export function ProductTable({ products, query, onEdit }: Props) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? products.filter(
        (item) =>
          item.nama_produk.toLowerCase().includes(normalizedQuery) ||
          item.sku?.toLowerCase().includes(normalizedQuery),
      )
    : products;

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Belum ada produk</p>
        <p className="mt-1">Tambah produk pertama untuk mulai transaksi inventory.</p>
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
        {filtered.map((product) => (
          <TableRow key={product.id_produk}>
            <TableCell>{product.nama_produk}</TableCell>
            <TableCell>
              <PriceCell product={product} />
            </TableCell>
            <TableCell>
              <StockCell product={product} />
            </TableCell>
            <TableCell>
              <Button onClick={() => onEdit(product)} size="sm" variant="outline">
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
  const largeStock = Math.max(0, Math.trunc(product.stok_unit_besar_saat_ini ?? 0));

  return (
    <div>
      <p>
        {product.stok_saat_ini} {smallUnit}
      </p>
      {largeUnit ? (
        <p className="text-xs text-muted-foreground">
          {largeStock} {largeUnit}
        </p>
      ) : null}
    </div>
  );
}
