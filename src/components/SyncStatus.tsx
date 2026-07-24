"use client";

// Shows a banner while queued entries are waiting for signal, and kicks
// off sync attempts on load, on reconnect, and every 30 seconds.

import { useEffect, useState } from "react";
import { onQueueChange, pendingCount } from "@/lib/queue";
import { syncPending } from "@/lib/data";

export default function SyncStatus() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setPending(pendingCount());
    const off = onQueueChange(() => setPending(pendingCount()));

    const trySync = () => {
      if (pendingCount() > 0) void syncPending();
    };
    trySync();
    window.addEventListener("online", trySync);
    const interval = setInterval(trySync, 30_000);
    return () => {
      off();
      window.removeEventListener("online", trySync);
      clearInterval(interval);
    };
  }, []);

  if (pending === 0) return null;
  return (
    <div className="sync-banner">
      📶 {pending} {pending === 1 ? "entry" : "entries"} saved locally — will
      sync when signal returns
    </div>
  );
}
