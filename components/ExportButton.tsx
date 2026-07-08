"use client";

export default function ExportButton({
  onExport,
  onAnnotateAll,
  busyText,
}: {
  onExport: () => void;
  onAnnotateAll: () => void;
  busyText: string | null;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        onClick={onExport}
        disabled={busyText !== null}
        data-testid="export-pdf"
        className="rounded-2xl bg-stone-900 px-5 py-3 font-semibold text-white shadow active:scale-95 transition disabled:opacity-50"
      >
        ⬇ Download annotated PDF
      </button>
      <button
        onClick={onAnnotateAll}
        disabled={busyText !== null}
        data-testid="annotate-all"
        className="rounded-2xl border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-stone-700 active:scale-95 transition disabled:opacity-50"
      >
        Annotate every page first (slower)
      </button>
      {busyText && (
        <div className="rounded-xl bg-stone-900 px-4 py-2 text-center text-sm font-medium text-white">
          {busyText}
        </div>
      )}
    </div>
  );
}
