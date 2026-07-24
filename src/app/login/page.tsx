"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Login failed");
      }
    } catch {
      setError("Can't reach the server — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ paddingTop: "18vh" }}>
      <h1 style={{ textAlign: "center" }}>🚜 Machine Hours</h1>
      <form onSubmit={submit} className="card">
        <label htmlFor="password">Crew password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !password}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
