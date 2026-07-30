"use client";

// Attach one checkout sheet photo. Uploads immediately so the entry only
// ever carries a storage path; if there's no signal the upload fails and
// says so, and the entry still saves without it.

import { useEffect, useRef, useState } from "react";
import { deleteSheetPhoto, sheetPhotoUrl, uploadSheetPhoto } from "@/lib/photo";

export default function SheetPhotoField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setPreview(null);
      return;
    }
    sheetPhotoUrl(value).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a retry
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const path = await uploadSheetPhoto(file);
      onChange(path);
    } catch {
      setError(
        "Photo didn't upload — no signal. Your entry will still save; add the photo later from the Entries tab."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!value) return;
    const path = value;
    onChange(null);
    try {
      await deleteSheetPhoto(path);
    } catch {
      // The entry no longer points at it; a stray object is harmless.
    }
  }

  return (
    <div>
      <label>Checkout sheet photo (optional)</label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Checkout sheet" className="sheet-preview" />
      )}
      {value && !preview && <p className="small muted">Loading photo…</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void pick(e)}
        style={{ display: "none" }}
      />

      <div className="row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-small btn-secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : value ? "Replace photo" : "📷 Take photo"}
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-small btn-danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="notice">{error}</p>}
    </div>
  );
}
