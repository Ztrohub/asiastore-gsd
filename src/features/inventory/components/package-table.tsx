"use client";

import { useDeferredValue, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyIdr } from "@/features/format/currency";
import type { ProductRecord } from "@/lib/offline/db";
import { formatQuantityForDisplay } from "@/lib/inventory/quantity";

type Props = {
  packages: ProductRecord[];
  query: string;
  onEdit: (pkg: ProductRecord) => void;
};

export function PackageTable({ packages, query, onEdit }: Props) {
  const deferredQuery = useDeferredValue(query);
  const filteredPackages = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return packages;
    }

    return packages.filter((pkg) => {
      const name = pkg.nama_produk.toLowerCase();
      const sku = pkg.sku?.toLowerCase() ?? "";
      return name.includes(normalizedQuery) || sku.includes(normalizedQuery);
    });
  }, [deferredQuery, packages]);

  if (filteredPackages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {deferredQuery.trim() ? "Paket tidak ditemukan" : "Belum ada paket"}
        </p>
        <p className="mt-1">
          {deferredQuery.trim()
            ? "Coba kata kunci lain untuk mencari paket."
            : "Tambah paket pertama untuk menjual gabungan beberapa produk."}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama paket</TableHead>
          <TableHead>SKU internal</TableHead>
          <TableHead>Harga paket</TableHead>
          <TableHead>Stok paket</TableHead>
          <TableHead>Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredPackages.map((pkg) => (
          <TableRow key={pkg.id_produk}>
            <TableCell>{pkg.nama_produk}</TableCell>
            <TableCell>{pkg.sku ?? "-"}</TableCell>
            <TableCell>{formatCurrencyIdr(pkg.harga_jual)}</TableCell>
            <TableCell>{formatQuantityForDisplay(pkg.stok_saat_ini)}</TableCell>
            <TableCell>
              <Button onClick={() => onEdit(pkg)} size="sm" variant="outline">
                Edit
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
