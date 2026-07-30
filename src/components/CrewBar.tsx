"use client";

// Shows which crew this phone is signed in as, and the way back out.
// Deliberately quiet: crews use one foreman all day, so this only needs
// to be findable, not prominent.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentCrew } from "@/lib/tenant";

export default function CrewBar() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setName(currentCrew()?.name ?? "");
  }, []);

  async function switchCrew() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // Falling through still lands on the login screen.
    }
    router.replace("/login");
    router.refresh();
  }

  if (!name) return null;

  return (
    <div className="crew-bar">
      <span className="muted small">
        Signed in as <strong>{name}</strong>
      </span>
      {confirming ? (
        <span className="row" style={{ gap: 6 }}>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => void switchCrew()}
          >
            Sign out
          </button>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button className="crew-switch" onClick={() => setConfirming(true)}>
          Switch
        </button>
      )}
    </div>
  );
}
