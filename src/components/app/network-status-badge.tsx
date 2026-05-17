"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function NetworkStatusBadge() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return <Badge variant="secondary">{online ? "Online" : "Offline"}</Badge>;
}
