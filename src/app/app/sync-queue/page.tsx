"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatJakartaDateTime } from "@/features/format/datetime";
import { retryInventorySyncNow } from "@/lib/offline/inventory-sync";
import { offlineDb, type SyncQueueRecord } from "@/lib/offline/db";
import { retryPosSyncNow } from "@/lib/offline/pos-sync";
import { resolveUnsyncedQueueReason, requeueSyncItem } from "@/lib/offline/sync-queue";
import { toast } from "sonner";

type QueueRowView = SyncQueueRecord & {
  label: string;
  payloadSummary?: string;
  reason: string;
};

function resolveEntityLabel(entityType: string) {
  if (entityType === "inventory_product") return "Produk";
  if (entityType === "inventory_mutation") return "Mutasi Stok";
  if (entityType === "pos_transaction") return "Transaksi POS";
  return entityType;
}

function resolvePayloadSummary(row: SyncQueueRecord) {
  try {
    const payload = JSON.parse(row.deltaPayload) as Record<string, unknown>;
    if (row.entityType === "inventory_product") {
      const name = typeof payload.nama_produk === "string" ? payload.nama_produk : row.entityId;
      return `Produk: ${name}`;
    }
    if (row.entityType === "inventory_mutation") {
      const jenis = typeof payload.jenis_mutasi === "string" ? payload.jenis_mutasi : "MUTASI";
      const productId = typeof payload.id_produk === "string" ? payload.id_produk : row.entityId;
      return `${jenis} - ${productId}`;
    }
    if (row.entityType === "pos_transaction") {
      const shortId =
        typeof payload.short_id === "string"
          ? payload.short_id
          : typeof payload.id_transaksi === "string"
            ? payload.id_transaksi
            : row.entityId;
      return `Transaksi: ${shortId}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function statusVariant(status: SyncQueueRecord["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "pending") return "secondary" as const;
  return "outline" as const;
}

export default function SyncQueuePage() {
  const [rows, setRows] = useState<QueueRowView[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const loadRows = useCallback(async () => {
    const queueRows = await offlineDb.syncQueue
      .where("status")
      .anyOf("pending", "failed", "sent")
      .sortBy("createdAt");
    const now = Date.now();
    const mapped = queueRows
      .slice()
      .reverse()
      .map((row) => ({
        ...row,
        label: resolveEntityLabel(row.entityType),
        payloadSummary: resolvePayloadSummary(row),
        reason: resolveUnsyncedQueueReason(row, now),
      }));
    setRows(mapped);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadRows();
      if (mounted) {
        setLoading(false);
      }
    })();

    const timer = window.setInterval(() => {
      loadRows().catch(() => undefined);
    }, 5_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [loadRows]);

  const unresolvedCount = useMemo(() => rows.length, [rows]);
  const failedCount = useMemo(
    () => rows.filter((row) => row.status === "failed" && typeof row.id === "number").length,
    [rows],
  );

  const retryOne = useCallback(
    async (row: QueueRowView) => {
      if (typeof row.id !== "number") {
        return;
      }
      await requeueSyncItem(row.id);
      if (row.entityType === "pos_transaction") {
        await retryPosSyncNow();
      } else {
        await retryInventorySyncNow();
      }
      await loadRows();
    },
    [loadRows],
  );

  const retryAllFailed = useCallback(async () => {
    const failedRows = rows.filter((row) => row.status === "failed" && typeof row.id === "number");
    if (failedRows.length === 0) return;

    setRetrying(true);
    try {
      await Promise.all(failedRows.map((row) => requeueSyncItem(row.id!)));
      const hasInventoryQueue = failedRows.some((row) => row.entityType !== "pos_transaction");
      const hasPosQueue = failedRows.some((row) => row.entityType === "pos_transaction");

      if (hasInventoryQueue) {
        await retryInventorySyncNow();
      }
      if (hasPosQueue) {
        await retryPosSyncNow();
      }
      await loadRows();
      toast.success("Retry queue gagal berhasil dijalankan.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry queue gagal.";
      toast.error(message);
    } finally {
      setRetrying(false);
    }
  }, [loadRows, rows]);

  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Queue Sync</h1>
        <p className="text-sm text-muted-foreground">
          Daftar antrean data yang belum tersinkron ke server beserta alasan terakhirnya.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {unresolvedCount} antrean belum sync
          </p>
          <div className="flex items-center gap-2">
            <Button
              disabled={retrying || failedCount === 0}
              onClick={retryAllFailed}
              size="sm"
              type="button"
              variant="outline"
            >
              {retrying ? "Memproses..." : "Retry Semua Gagal"}
            </Button>
            <Button onClick={() => loadRows()} size="sm" type="button" variant="outline">
              Refresh
            </Button>
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Memuat queue...</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada queue tertunda. Semua data sudah sinkron.</p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu antre</TableHead>
                <TableHead>Entitas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Percobaan</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Alasan Belum Sync</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.entityType}-${row.entityId}-${row.createdAt}-${row.id ?? "na"}`}>
                  <TableCell>{formatJakartaDateTime(row.createdAt)}</TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell>{row.attemptCount}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-foreground">{row.payloadSummary ?? row.entityId}</p>
                      <p className="text-muted-foreground">ID: {row.entityId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground">{row.reason}</p>
                  </TableCell>
                  <TableCell>
                    {row.status === "failed" && typeof row.id === "number" ? (
                      <Button
                        onClick={() => retryOne(row)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </section>
    </main>
  );
}
