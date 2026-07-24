"use client";

// Public page (no password) so it can be sent to anyone. Detects the
// phone and shows only the steps that apply to it, because the wording
// differs per browser and guessing wrong is worse than saying nothing.

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "installed" | "desktop";

// Chrome's install prompt event, which TS doesn't ship types for.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS reports installed apps through a non-standard flag
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setPlatform("installed");
      return;
    }
    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="shell">
      <h1>📱 Put it on your phone</h1>

      {platform === "installed" && (
        <div className="card">
          <p className="notice notice-ok" style={{ marginTop: 0 }}>
            ✓ You&apos;re all set — you&apos;re using the installed app right
            now.
          </p>
        </div>
      )}

      {platform === "ios" && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Three taps and the app icon lands on your home screen, just like
            any other app.
          </p>
          <ol className="steps">
            <li>
              Tap the <strong>Share</strong> button at the bottom of the screen
              — the square with an arrow pointing up.
              <span className="step-icon" aria-hidden>
                ⬆️
              </span>
            </li>
            <li>
              Scroll down the list and tap{" "}
              <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> in the top right corner.
            </li>
          </ol>
          <p className="notice">
            Use <strong>Safari</strong> for this. If you opened this from
            Facebook, Gmail, or a text message, tap the ⋯ menu and choose
            &ldquo;Open in Safari&rdquo; first.
          </p>
        </div>
      )}

      {platform === "android" && (
        <div className="card">
          {promptEvent ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Tap the button and confirm — the app icon goes straight to your
                home screen.
              </p>
              <button
                className="btn"
                onClick={() => {
                  void promptEvent.prompt();
                  setPromptEvent(null);
                }}
              >
                ⬇️ Install App
              </button>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Three taps and the app icon lands on your home screen.
              </p>
              <ol className="steps">
                <li>
                  Tap the <strong>⋮</strong> menu in the top right of Chrome.
                </li>
                <li>
                  Tap <strong>Add to Home screen</strong> (it may say{" "}
                  <strong>Install app</strong>).
                </li>
                <li>
                  Tap <strong>Install</strong> to confirm.
                </li>
              </ol>
            </>
          )}
        </div>
      )}

      {platform === "desktop" && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            This is meant for phones. Open{" "}
            <strong>ge-eqh.vercel.app/install</strong> on your phone and the
            right steps will show up automatically.
          </p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Once it&apos;s on your phone</h2>
        <p className="muted small">
          Open it from the icon like any app — no web address to type, and no
          browser bars in the way. It asks for the crew password the first
          time and then remembers you.
        </p>
      </div>

      <a
        href="/"
        className="btn"
        style={{ textAlign: "center", textDecoration: "none" }}
      >
        Continue to the app
      </a>
    </div>
  );
}
