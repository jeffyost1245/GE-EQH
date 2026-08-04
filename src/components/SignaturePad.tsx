"use client";

// Sign with a finger. The strokes are kept as points rather than an
// image: a few hundred bytes instead of a hundred kilobytes, it queues
// with the rest of the sheet when there's no signal, and the PDF can
// redraw it as vectors so it stays sharp on the printed record.

import { useCallback, useEffect, useRef, useState } from "react";
import { Signature } from "@/lib/types";

const HEIGHT = 150;

export default function SignaturePad({
  value,
  onChange,
  disabled = false,
}: {
  value: Signature | null;
  onChange: (signature: Signature | null) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<[number, number][][]>(value?.strokes ?? []);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState((value?.strokes.length ?? 0) > 0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = canvas.clientWidth;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(HEIGHT * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, HEIGHT);

    context.strokeStyle = "#1f2328";
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length === 1) {
        context.beginPath();
        context.arc(stroke[0][0], stroke[0][1], 1.1, 0, Math.PI * 2);
        context.fillStyle = "#1f2328";
        context.fill();
        continue;
      }
      context.beginPath();
      stroke.forEach(([x, y], i) =>
        i === 0 ? context.moveTo(x, y) : context.lineTo(x, y)
      );
      context.stroke();
    }
  }, []);

  useEffect(() => {
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [redraw]);

  // Adopt a signature loaded after first paint (reopening a saved sheet).
  useEffect(() => {
    if (value && value.strokes !== strokesRef.current) {
      strokesRef.current = value.strokes;
      setHasInk(value.strokes.length > 0);
      redraw();
    }
  }, [value, redraw]);

  function pointAt(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      Math.round((event.clientX - box.left) * 10) / 10,
      Math.round((event.clientY - box.top) * 10) / 10,
    ] as [number, number];
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, [pointAt(event)]];
    redraw();
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    stroke.push(pointAt(event));
    redraw();
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHasInk(true);
    commit();
  }

  function commit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange({
      w: canvas.clientWidth,
      h: HEIGHT,
      strokes: strokesRef.current,
    });
  }

  function clear() {
    strokesRef.current = [];
    setHasInk(false);
    redraw();
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="sigpad"
        style={{ height: HEIGHT }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        aria-label="Sign with your finger"
      />
      <div className="sigrow">
        <span className="small muted">
          {hasInk ? "Signed" : "Sign with your finger"}
        </span>
        {hasInk && !disabled && (
          <button type="button" className="linkish" onClick={clear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
