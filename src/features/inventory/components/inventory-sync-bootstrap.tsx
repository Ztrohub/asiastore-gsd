"use client";

import { useEffect } from "react";
import { startInventorySyncLoop } from "@/lib/offline/inventory-sync";

export function InventorySyncBootstrap() {
  useEffect(() => {
    const stop = startInventorySyncLoop();
    return () => {
      stop();
    };
  }, []);

  return null;
}
