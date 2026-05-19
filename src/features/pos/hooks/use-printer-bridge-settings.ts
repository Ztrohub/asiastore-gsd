"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PRINTER_BRIDGE_SETTINGS,
  loadPrinterBridgeSettings,
  savePrinterBridgeSettings,
  type PrinterBridgeSettings,
} from "@/features/pos/lib/printer-bridge-settings";

export function usePrinterBridgeSettings() {
  const [settings, setSettings] = useState<PrinterBridgeSettings>(DEFAULT_PRINTER_BRIDGE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadPrinterBridgeSettings()
      .then((value) => {
        if (!mounted) return;
        setSettings(value);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function persist(next: PrinterBridgeSettings) {
    setSaving(true);
    try {
      const saved = await savePrinterBridgeSettings(next);
      setSettings(saved);
      return saved;
    } finally {
      setSaving(false);
    }
  }

  return { settings, setSettings, loading, saving, persist };
}

