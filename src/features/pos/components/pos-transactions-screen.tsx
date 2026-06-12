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
import { PosRemoveDialog } from "@/features/pos/components/pos-remove-dialog";
import { TransactionEditDialog } from "@/features/pos/components/transaction-edit-dialog";
import { usePrinterBridgeSettings } from "@/features/pos/hooks/use-printer-bridge-settings";
import { useReceiptPrinting } from "@/features/pos/hooks/use-receipt-printing";
import { usePosTransactions } from "@/features/pos/hooks/use-pos-transactions";
import { formatQuantityForDisplay } from "@/lib/inventory/quantity";
import type { PosTransactionRecord } from "@/lib/offline/db";

function resolvePaymentLabel(paymentMethod: "cash" | "bank_transfer") {
  return paymentMethod === "cash" ? "Tunai" : "Transfer";
}

type ActionStatus = {
  message: string;
  type: "success" | "error";
};

export function PosTransactionsScreen() {
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<PosTransactionRecord | null>(null);
  const [printTarget, setPrintTarget] = useState<PosTransactionRecord | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  const [transactionOverrides, setTransactionOverrides] = useState<
    Record<string, PosTransactionRecord>
  >({});
  const { settings: printerSettings } = usePrinterBridgeSettings();
  const { printStatusMessage, printStatusType, printTransaction } = useReceiptPrinting();
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
    updateTransaction,
    softDeleteTransaction,
    restoreTransaction,
  } = usePosTransactions();
  const displayRows = rows.map((row) => transactionOverrides[row.id_transaksi] ?? row);

  const upsertTransactionState = (transaction: PosTransactionRecord) => {
    setEditingTransaction(transaction);
    setTransactionOverrides((current) => ({
      ...current,
      [transaction.id_transaksi]: transaction,
    }));
  };

  return (
    <section className="space-y-4">
      {actionStatus ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            actionStatus.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {actionStatus.message}
        </div>
      ) : null}

      {printStatusMessage ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            printStatusType === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {printStatusMessage}
        </div>
      ) : null}

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
              {displayRows.map((row) => {
                const expanded = expandedTransactionId === row.id_transaksi;
                return (
                  <Fragment key={row.id_transaksi}>
                    <TableRow
                      aria-expanded={expanded}
                    >
                      <TableCell>{formatJakartaDateTime(row.client_timestamp)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{row.short_id}</p>
                            {row.is_deleted ? <Badge variant="destructive">Terhapus</Badge> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{row.id_transaksi}</p>
                        </div>
                      </TableCell>
                      <TableCell>{row.kasir_username}</TableCell>
                      <TableCell>{resolvePaymentLabel(row.payment_method)}</TableCell>
                      <TableCell>{formatCurrencyIdr(row.total_amount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
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
                          <Button
                            aria-label={`Print ulang transaksi ${row.short_id}`}
                            onClick={() => setPrintTarget(row)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Print ulang
                          </Button>
                          <Button
                            aria-label={`Edit transaksi ${row.short_id}`}
                            onClick={() => setEditingTransaction(row)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Edit transaksi
                          </Button>
                        </div>
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
                                      {line.pricing_snapshot?.breakdown?.length ? (
                                        <div className="space-y-0.5 text-xs text-muted-foreground">
                                          {line.pricing_snapshot.breakdown.map((breakdownRow, breakdownIndex) => (
                                            <p key={`${row.id_transaksi}-${line.id_produk}-breakdown-${breakdownIndex}`}>
                                              {formatQuantityForDisplay(breakdownRow.qty)} x{" "}
                                              {formatCurrencyIdr(breakdownRow.unit_price)}
                                            </p>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">
                                          {formatQuantityForDisplay(line.qty)} x {formatCurrencyIdr(line.unit_price)}
                                          {line.unit_label ? ` / ${line.unit_label}` : ""}
                                        </p>
                                      )}
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

      <TransactionEditDialog
        onClose={() => setEditingTransaction(null)}
        onDelete={async (id_transaksi) => {
          try {
            const nextTransaction = await softDeleteTransaction(id_transaksi);
            upsertTransactionState(nextTransaction);
            setActionStatus({
              type: "success",
              message: "Transaksi berhasil dinonaktifkan.",
            });
          } catch {
            setActionStatus({
              type: "error",
              message: "Delete transaksi gagal. Coba lagi.",
            });
          }
        }}
        onRestore={async (id_transaksi) => {
          try {
            const nextTransaction = await restoreTransaction(id_transaksi);
            upsertTransactionState(nextTransaction);
            setActionStatus({
              type: "success",
              message: "Transaksi berhasil diaktifkan kembali.",
            });
          } catch {
            setActionStatus({
              type: "error",
              message: "Aktivasi ulang transaksi gagal. Coba lagi.",
            });
          }
        }}
        onSave={async (input) => {
          try {
            const nextTransaction = await updateTransaction(input);
            upsertTransactionState(nextTransaction);
            setActionStatus({
              type: "success",
              message: "Perubahan transaksi berhasil disimpan.",
            });
          } catch {
            setActionStatus({
              type: "error",
              message: "Perubahan transaksi gagal disimpan. Coba lagi.",
            });
          }
        }}
        open={Boolean(editingTransaction)}
        saving={false}
        transaction={editingTransaction}
      />

      <PosRemoveDialog
        confirmLabel="Print ulang"
        confirmVariant="default"
        description="Receipt transaksi ini akan dikirim ulang ke printer thermal."
        onClose={() => setPrintTarget(null)}
        onConfirm={() => {
          if (!printTarget) return;
          printTransaction(printerSettings, printTarget)
            .catch(() => undefined)
            .finally(() => setPrintTarget(null));
        }}
        open={Boolean(printTarget)}
        title="Print ulang transaksi?"
      />
    </section>
  );
}
