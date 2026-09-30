// A one-shot message handed from the screen that did something to the
// screen you land on.
//
// Saving the last entry of a checkout-sheet round trip sends you to the
// dashboard, and the confirmation has to travel with you or the save
// looks like it did nothing. sessionStorage rather than a query
// parameter: it shows once, survives the navigation, and leaves no URL
// that says "saved" every time it is reloaded or shared.

const KEY = "eqh_flash";

export interface Flash {
  /** ok is the green notice; plain is the ordinary one. */
  kind: "ok" | "plain";
  text: string;
}

export function setFlash(flash: Flash): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(flash));
  } catch {
    // Private mode or a full store: the save still happened, it just
    // isn't announced on the next screen.
  }
}

/** Read the message and clear it, so it is only ever shown once. */
export function takeFlash(): Flash | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as Flash) : null;
  } catch {
    return null;
  }
}
