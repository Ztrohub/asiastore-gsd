"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getDefaultPosTransactionFilters,
  listLocalPosTransactionsPage,
  syncPosTransactionsFromServer,
} from "@/lib/offline/pos-transaction-history";
import { type PosTransactionRecord } from "@/lib/offline/db";

const DEFAULT_PAGE_SIZE = 10;

export function usePosTransactions() {
  const defaults = getDefaultPosTransactionFilters();
  const [rows, setRows] = useState<PosTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [dateFrom, setDateFromState] = useState(defaults.dateFrom);
  const [dateTo, setDateToState] = useState(defaults.dateTo);

  const loadLocalPage = useCallback(async () => {
    const result = await listLocalPosTransactionsPage({
      dateFrom,
      dateTo,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    setRows(result.rows);
    setHasPreviousPage(result.hasPreviousPage);
    setHasNextPage(result.hasNextPage);
  }, [dateFrom, dateTo, page]);

  const reload = useCallback(async () => {
    setSyncing(true);
    try {
      if (navigator.onLine) {
        await syncPosTransactionsFromServer();
      }
      await loadLocalPage();
    } finally {
      setSyncing(false);
    }
  }, [loadLocalPage]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadLocalPage();
      } catch {
        // Keep best-effort local loading behavior.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadLocalPage]);

  useEffect(() => {
    if (!navigator.onLine) {
      return;
    }

    const timer = window.setTimeout(() => {
      reload().catch(() => undefined);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [reload]);

  useEffect(() => {
    const handleOnline = () => {
      reload().catch(() => undefined);
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [reload]);

  const setDateFrom = useCallback((value: string) => {
    setPage(1);
    setDateFromState(value);
  }, []);

  const setDateTo = useCallback((value: string) => {
    setPage(1);
    setDateToState(value);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  return {
    rows,
    loading,
    syncing,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    hasPreviousPage,
    hasNextPage,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    goToPreviousPage,
    goToNextPage,
    reload,
  };
}
