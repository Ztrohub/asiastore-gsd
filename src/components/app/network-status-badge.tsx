"use client";

import { Badge } from "@/components/ui/badge";
import { useConnectivity } from "@/hooks/use-connectivity";

export function NetworkStatusBadge() {
  const { online } = useConnectivity();

  return <Badge variant="secondary">{online ? "Online" : "Offline"}</Badge>;
}
