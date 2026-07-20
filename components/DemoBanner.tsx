/**
 * Persistent demo-mode banner. The seeded dataset is a fictional scenario;
 * this label is a product-safety requirement, not decoration — the app never
 * presents fixture data as real current events.
 */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="w-full text-center text-[12px] leading-6 px-2"
      style={{
        background: "var(--warn)",
        color: "var(--bg)",
        paddingTop: "var(--sat)",
      }}
    >
      Demo data — fictional scenario. No live sources are connected.
    </div>
  );
}
