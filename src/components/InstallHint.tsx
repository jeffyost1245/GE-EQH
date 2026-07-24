"use client";

// Nudges people who are using the app in a browser tab toward installing
// it. Hidden once installed, or once dismissed on this phone.

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "eqh_install_hint_dismissed";

export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="install-hint">
      <Link href="/install">📱 Put this app on your phone</Link>
      <button
        aria-label="Dismiss"
        onClick={() => {
          window.localStorage.setItem(DISMISSED_KEY, "1");
          setShow(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
