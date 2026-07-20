"use client";

import { useCallback, useEffect, useRef } from "react";
import { IncidentDetailBody } from "@/components/incident/IncidentDetailBody";
import type { PublicIncidentProjection } from "@/lib/domain/projection";

export type SheetState = "peek" | "half" | "full";

const ORDER: SheetState[] = ["peek", "half", "full"];

/**
 * Mobile bottom sheet / desktop side panel for incident details.
 * Deterministic snap points, drag handle, keyboard control, focus management,
 * and browser-history integration are handled by the parent via props.
 */
export function IncidentSheet({
  incident,
  state,
  onStateChange,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  incident: PublicIncidentProjection;
  state: SheetState;
  onStateChange: (s: SheetState) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dragStart = useRef<{ y: number; state: SheetState } | null>(null);

  // Screen-reader focus moves to the sheet heading when it opens or the
  // incident changes.
  useEffect(() => {
    headingRef.current?.focus();
  }, [incident.id]);

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const idx = ORDER.indexOf(state);
      const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, idx + dir))];
      onStateChange(next);
    },
    [state, onStateChange],
  );

  function onHandleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      cycle(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (state === "peek") onClose();
      else cycle(-1);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = { y: e.clientY, state };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = null;
    if (Math.abs(dy) < 40) return;
    if (dy < 0) cycle(1);
    else if (state === "peek") onClose();
    else cycle(-1);
  }

  const heights: Record<SheetState, string> = {
    peek: "150px",
    half: "48dvh",
    full: "calc(100dvh - var(--nav-h, 0px) - 56px)",
  };

  return (
    <div
      role="dialog"
      aria-modal={state === "full"}
      aria-label={incident.headline}
      className="fixed inset-x-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border md:left-auto md:right-4 md:w-[420px] md:rounded-2xl"
      style={{
        bottom: "var(--nav-h, 0px)",
        height: heights[state],
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--sheet-shadow)",
        transition: "height 200ms ease",
        touchAction: "none",
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        aria-label={`Sheet size: ${state}. Arrow up to expand, arrow down to shrink or close.`}
        className="tap w-full shrink-0 cursor-grab pt-2"
        onKeyDown={onHandleKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={() => cycle(state === "full" ? -1 : 1)}
      >
        <span
          aria-hidden="true"
          className="block h-1.5 w-10 rounded-full"
          style={{ background: "var(--border)" }}
        />
      </button>

      <div className="flex shrink-0 items-center gap-1 px-4 pb-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 flex-1 truncate text-base font-bold"
        >
          {incident.headline}
        </h2>
        <button
          type="button"
          className="tap"
          aria-label="Previous incident"
          disabled={!hasPrev}
          onClick={onPrev}
          style={{ opacity: hasPrev ? 1 : 0.35 }}
        >
          ‹
        </button>
        <button
          type="button"
          className="tap"
          aria-label="Next incident"
          disabled={!hasNext}
          onClick={onNext}
          style={{ opacity: hasNext ? 1 : 0.35 }}
        >
          ›
        </button>
        <button type="button" className="tap" aria-label="Close details" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6" style={{ touchAction: "pan-y" }}>
        <IncidentDetailBody incident={incident} />
      </div>
    </div>
  );
}
