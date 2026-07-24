"use client";

// Re-locks the management screens on this phone. Admin access also
// expires on its own after 12 hours.

import { useRouter } from "next/navigation";

export default function LockAdmin() {
  const router = useRouter();

  async function lock() {
    try {
      await fetch("/api/admin-logout", { method: "POST" });
    } catch {
      // If the request fails the cookie stays until it expires; nothing
      // useful to tell the user here.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <button className="btn btn-small btn-secondary" onClick={() => void lock()}>
      🔒 Lock
    </button>
  );
}
