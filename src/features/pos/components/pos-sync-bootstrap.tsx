"use client";

import { useEffect } from "react";
import { runPosSyncPass } from "@/lib/offline/pos-sync";

export function PosSyncBootstrap() {
  useEffect(() => {
    let stop = false;
    const run = () => {
      if (stop) return;
      runPosSyncPass().catch(() => undefined);
    };
    run();
    window.addEventListener("online", run);
    const timer = window.setInterval(run, 30_000);
    return () => {
      stop = true;
      window.removeEventListener("online", run);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}

