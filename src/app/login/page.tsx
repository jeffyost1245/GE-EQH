"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listForemen } from "@/lib/data";
import { Foreman } from "@/lib/types";

const LAST_FOREMAN_KEY = "eqh_last_foreman";

export default function LoginPage() {
  const router = useRouter();
  const [foremen, setForemen] = useState<Foreman[]>([]);
  const [foremanId, setForemanId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listForemen()
      .then((list) => {
        setForemen(list);
        // A phone almost always belongs to the same crew, so preselect
        // whoever signed in here last.
        const last = window.localStorage.getItem(LAST_FOREMAN_KEY);
        if (last && list.some((f) => f.id === last)) setForemanId(last);
        else if (list.length === 1) setForemanId(list[0].id);
      })
      .catch(() =>
        setError("Can't load the crew list — check your signal and reload.")
      )
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const name = foremen.find((f) => f.id === foremanId)?.name ?? "";
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foremanId, password, name }),
      });
      if (res.ok) {
        window.localStorage.setItem(LAST_FOREMAN_KEY, foremanId);
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
    <div className="shell" style={{ paddingTop: "12vh" }}>
      <h1 style={{ textAlign: "center" }}>🚜 Machine Hours</h1>
      <form onSubmit={submit} className="card">
        <label htmlFor="foreman">Foreman</label>
        <select
          id="foreman"
          value={foremanId}
          onChange={(e) => setForemanId(e.target.value)}
          disabled={loading}
        >
          <option value="">
            {loading ? "Loading…" : "Choose your foreman…"}
          </option>
          {foremen.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <label htmlFor="password">Crew password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !password || !foremanId}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
