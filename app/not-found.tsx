import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--muted)" }}>
        This item doesn&apos;t exist or isn&apos;t published. Incidents under a safety
        embargo or risk review are indistinguishable from nonexistent ones.
      </p>
      <Link href="/" className="chip tap px-4" style={{ color: "var(--accent)" }}>
        ← Back to the map
      </Link>
    </div>
  );
}
