"use client";

import { useCallback, useEffect, useState } from "react";

const CONNECTIVITY_POLL_MS = 30_000;

async function checkReachable() {
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function useConnectivity() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    const reachable = await checkReachable();
    setOnline(reachable);
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      sync().catch(() => undefined);
    }, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    const timer = window.setInterval(() => {
      sync().catch(() => undefined);
    }, CONNECTIVITY_POLL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [sync]);

  return { online };
}
