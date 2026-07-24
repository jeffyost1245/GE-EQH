"use client";

// Admin unlock. Reached when someone taps Machines or Crew without the
// admin cookie; sends them back where they were headed once unlocked.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";

function AdminUnlock() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/machines";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next.startsWith("/") ? next : "/machines");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Unlock failed");
      }
    } catch {
      setError("Can't reach the server — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Admin Only">
      <form className="card" onSubmit={submit}>
        <p className="muted small" style={{ marginTop: 0 }}>
          Adding, renaming, retiring, or deleting machines and crew is
          restricted. Logging hours doesn&apos;t need this.
        </p>
        <label htmlFor="admin-password">Admin password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="off"
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !password}>
          {busy ? "Checking…" : "Unlock"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/")}
        >
          Back to Dashboard
        </button>
      </form>
    </AppShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AppShell title="Admin Only">Loading…</AppShell>}>
      <AdminUnlock />
    </Suspense>
  );
}
