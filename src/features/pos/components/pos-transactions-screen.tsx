"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyIdr } from "@/features/format/currency";
import { formatJakartaDateTime } from "@/features/format/datetime";
import { usePosTransactions } from "@/features/pos/hooks/use-pos-transactions";

function resolvePaymentLabel(paymentMethod: "cash" | "bank_transfer") {
  return paymentMethod === "cash" ? "Tunai" : "Transfer";
}

export function PosTransactionsScreen() {
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const {
    rows,
    loading,
    syncing,
    page,
    hasPreviousPage,
    hasNextPage,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    goToPreviousPage,
    goToNextPage,
    reload,
  } = usePosTransactions();

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Tanggal mulai</span>
              <Input
                aria-label="Tanggal mulai"
                onChange={(event) => setDateFrom(event.target.value)}
                type="date"
                value={dateFrom}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Tanggal akhir</span>
              <Input
                aria-label="Tanggal akhir"
                onChange={(event) => setDateTo(event.target.value)}
                type="date"
                value={dateTo}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={syncing ? "secondary" : "outline"}>
              {syncing ? "Sinkronisasi..." : "Lokal siap"}
            </Badge>
            <Button onClick={() => reload()} type="button" variant="outline">
              Refresh transaksi
            </Button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Halaman {page}</p>
          <div className="flex items-center gap-2">
            <Button
              disabled={!hasPreviousPage}
              onClick={goToPreviousPage}
              size="sm"
              type="button"
              variant="outline"
            >
              Halaman sebelumnya
            </Button>
            <Button
              disabled={!hasNextPage}
              onClick={goToNextPage}
              size="sm"
              type="button"
              variant="outline"
            >
              Halaman berikutnya
            </Button>
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Memuat transaksi...</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada transaksi pada rentang tanggal ini di database lokal.
          </p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Pembayaran</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const expanded = expandedTransactionId === row.id_transaksi;
                return (
                  <Fragment key={row.id_transaksi}>
                    <TableRow
                      aria-expanded={expanded}
                    >
                      <TableCell>{formatJakartaDateTime(row.client_timestamp)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{row.short_id}</p>
                          <p className="text-xs text-muted-foreground">{row.id_transaksi}</p>
                        </div>
                      </TableCell>
                      <TableCell>{row.kasir_username}</TableCell>
                      <TableCell>{resolvePaymentLabel(row.payment_method)}</TableCell>
                      <TableCell>{formatCurrencyIdr(row.total_amount)}</TableCell>
                      <TableCell>
                        <Button
                          aria-label={`Detail transaksi ${row.short_id}`}
                          onClick={() =>
                            setExpandedTransactionId(expanded ? null : row.id_transaksi)
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {expanded ? "Tutup" : "Detail"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow key={`${row.id_transaksi}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/20">
                          <div className="space-y-3 py-2">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1 text-sm">
                                <p className="font-medium">Ringkasan pembayaran</p>
                                <p>Total: {formatCurrencyIdr(row.total_amount)}</p>
                                {typeof row.amount_received === "number" ? (
                                  <p>Diterima: {formatCurrencyIdr(row.amount_received)}</p>
                                ) : null}
                                {typeof row.change_amount === "number" ? (
                                  <p>Kembalian: {formatCurrencyIdr(row.change_amount)}</p>
                                ) : null}
                              </div>
                              <div className="space-y-1 text-sm">
                                <p className="font-medium">Catatan</p>
                                <p className="text-muted-foreground">{row.note ?? "-"}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-sm font-medium">Item transaksi</p>
                              <div className="space-y-2">
                                {row.lines.map((line, index) => (
                                  <div
                                    className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                                    key={`${row.id_transaksi}-${line.id_produk}-${index}`}
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium">{line.nama_produk}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {line.qty} x {formatCurrencyIdr(line.unit_price)}
                                        {line.unit_label ? ` / ${line.unit_label}` : ""}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p>{formatCurrencyIdr(line.line_total)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Diskon {formatCurrencyIdr(line.line_discount)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </section>
    </section>
  );
}
