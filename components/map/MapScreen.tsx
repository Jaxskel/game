"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import type { PublicIncidentProjection } from "@/lib/domain/projection";
import { INCIDENT_CATEGORIES, type IncidentCategory } from "@/lib/domain/types";
import { relativeTime } from "@/lib/format";
import { circlePolygon } from "@/lib/geo";
import { SearchOverlay } from "@/components/SearchOverlay";
import { IncidentSheet, type SheetState } from "./IncidentSheet";
import { MapListView } from "./MapListView";

type TimeKey = "latest" | "24h" | "7d" | "30d" | "custom";

const TIME_HOURS: Record<Exclude<TimeKey, "latest" | "custom">, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

interface ApiIncidents {
  items: PublicIncidentProjection[];
  lastUpdated: string;
  dataMode: string;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Read initial UI state from the shareable URL (viewport + filters only —
 * never anything more precise than generalized public data). */
function readUrlState() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    t: (p.get("t") as TimeKey) || undefined,
    customHours: p.get("th") ? Number(p.get("th")) : undefined,
    cats: p.get("cat")?.split(",").filter(Boolean) as IncidentCategory[] | undefined,
    selected: p.get("i") || undefined,
    view: p.get("view") === "list" ? ("list" as const) : ("map" as const),
    ll: p.get("ll")?.split(",").map(Number),
  };
}

export function MapScreen() {
  const initial = useMemo(readUrlState, []);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const incidentsRef = useRef<PublicIncidentProjection[]>([]);

  const [timeKey, setTimeKey] = useState<TimeKey>(initial.t ?? "latest");
  const [customHours, setCustomHours] = useState<number>(initial.customHours ?? 72);
  const [cats, setCats] = useState<Set<IncidentCategory>>(new Set(initial.cats ?? []));
  const [incidents, setIncidents] = useState<PublicIncidentProjection[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selected ?? null);
  const [sheetState, setSheetState] = useState<SheetState>("half");
  const [view, setView] = useState<"map" | "list">(initial.view ?? "map");
  const [webglFailed, setWebglFailed] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [heat, setHeat] = useState(false);

  const sinceHours =
    timeKey === "latest" ? undefined : timeKey === "custom" ? customHours : TIME_HOURS[timeKey];

  const visible = useMemo(
    () => (cats.size === 0 ? incidents : incidents.filter((i) => cats.has(i.category))),
    [incidents, cats],
  );
  useEffect(() => {
    incidentsRef.current = visible;
  }, [visible]);

  const selected = visible.find((i) => i.id === selectedId) ?? null;
  const selectedIndex = selected ? visible.findIndex((i) => i.id === selected.id) : -1;

  // ---- data --------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (sinceHours) params.set("sinceHours", String(sinceHours));
    fetch(`/api/v1/incidents?${params}`)
      .then((r) => r.json())
      .then((data: ApiIncidents) => {
        if (cancelled) return;
        setIncidents(data.items);
        setLastUpdated(data.lastUpdated);
      })
      .catch(() => {
        if (!cancelled) setIncidents([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sinceHours]);

  // ---- shareable URL sync ------------------------------------------------
  useEffect(() => {
    const p = new URLSearchParams();
    if (timeKey !== "latest") p.set("t", timeKey);
    if (timeKey === "custom") p.set("th", String(customHours));
    if (cats.size > 0) p.set("cat", [...cats].join(","));
    if (selectedId) p.set("i", selectedId);
    if (view === "list") p.set("view", "list");
    const map = mapRef.current;
    if (map) {
      const c = map.getCenter();
      p.set(
        "ll",
        `${c.lat.toFixed(2)},${c.lng.toFixed(2)},${map.getZoom().toFixed(1)}`,
      );
    }
    const qs = p.toString();
    window.history.replaceState(
      window.history.state,
      "",
      qs ? `/?${qs}` : "/",
    );
  }, [timeKey, customHours, cats, selectedId, view]);

  // ---- sheet open/close with browser history -----------------------------
  const closeSheet = useCallback(() => {
    setSelectedId(null);
    if (window.history.state?.gcmSheet) window.history.back();
  }, []);

  const openIncident = useCallback((id: string) => {
    setSelectedId((prev) => {
      if (!prev) window.history.pushState({ gcmSheet: true }, "");
      return id;
    });
    setSheetState("half");
    setView("map");
    const incident = incidentsRef.current.find((i) => i.id === id);
    const map = mapRef.current;
    if (incident && map) {
      const move = { center: [incident.location.lon, incident.location.lat] as [number, number] };
      if (reducedMotion()) map.jumpTo({ ...move, zoom: Math.max(map.getZoom(), 4) });
      else map.easeTo({ ...move, zoom: Math.max(map.getZoom(), 4), duration: 600 });
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!window.history.state?.gcmSheet) setSelectedId(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ---- map lifecycle -----------------------------------------------------
  useEffect(() => {
    if (view !== "map" || webglFailed || mapRef.current || !mapContainer.current) return;

    const styles = getComputedStyle(document.documentElement);
    const isLight = styles.getPropertyValue("--bg").trim().startsWith("#f");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        attributionControl: false,
        style: {
          version: 8,
          projection: { type: "globe" },
          sources: {
            countries: { type: "geojson", data: "/data/countries.json" },
          },
          layers: [
            {
              id: "bg",
              type: "background",
              paint: { "background-color": isLight ? "#c9d7e4" : "#060a10" },
            },
            {
              id: "countries-fill",
              type: "fill",
              source: "countries",
              paint: { "fill-color": isLight ? "#f2f5f8" : "#1a222d" },
            },
            {
              id: "countries-line",
              type: "line",
              source: "countries",
              paint: {
                "line-color": isLight ? "#8fa3b5" : "#3d4d5f",
                "line-width": 0.6,
              },
            },
          ],
        },
        center: initial.ll ? [initial.ll[1], initial.ll[0]] : [20, 30],
        zoom: initial.ll?.[2] ?? 1.6,
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    mapRef.current = map;
    // Test/debug handle (used by e2e to await map readiness).
    (window as unknown as { __gcmMap?: maplibregl.Map }).__gcmMap = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("error", () => {
      /* tile/style errors are non-fatal; markers are HTML */
    });

    map.on("load", () => {
      map.addSource("incidents", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 8,
      });
      map.addSource("uncertainty", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "uncertainty-fill",
        type: "fill",
        source: "uncertainty",
        paint: { "fill-color": "#5aa9ff", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "uncertainty-line",
        type: "line",
        source: "uncertainty",
        paint: { "line-color": "#5aa9ff", "line-width": 1.5, "line-dasharray": [2, 2] },
      });
      // Invisible anchor layer: a source with no visible layer never loads
      // tiles, which would leave querySourceFeatures (and our HTML markers)
      // empty. Radius 0 renders nothing but keeps the source active.
      map.addLayer({
        id: "incidents-anchor",
        type: "circle",
        source: "incidents",
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });
      map.addLayer({
        id: "heat",
        type: "heatmap",
        source: "incidents",
        layout: { visibility: "none" },
        paint: {
          "heatmap-radius": 40,
          "heatmap-opacity": 0.5,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.4, "#3b82f6",
            1, "#f59e0b",
          ],
        },
      });
      syncMapData();
    });

    const update = () => updateMarkers();
    map.on("moveend", update);
    map.on("sourcedata", update);
    // sourcedata can fire before features are queryable; idle always follows
    // the final render of new data.
    map.on("idle", update);

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, webglFailed]);

  const syncMapData = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource<maplibregl.GeoJSONSource>("incidents");
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: incidentsRef.current.map((i) => ({
        type: "Feature",
        properties: { id: i.id, category: i.category },
        geometry: {
          type: "Point",
          coordinates: [i.location.lon, i.location.lat],
        },
      })),
    });
    // Marker refresh happens on the following sourcedata events.
  }, []);

  useEffect(() => {
    syncMapData();
    // Also drop markers for incidents that vanished.
    updateMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Selected-incident uncertainty circle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("uncertainty")) return;
    const source = map.getSource<maplibregl.GeoJSONSource>("uncertainty");
    source?.setData(
      selected
        ? circlePolygon(selected.location.lat, selected.location.lon, selected.location.uncertaintyKm)
        : { type: "FeatureCollection", features: [] },
    );
    markersRef.current.forEach((marker, key) => {
      marker.getElement().setAttribute("data-selected", String(key === `p:${selected?.id}`));
    });
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("heat")) return;
    map.setLayoutProperty("heat", "visibility", heat ? "visible" : "none");
  }, [heat]);

  function updateMarkers() {
    const map = mapRef.current;
    if (!map || !map.getSource("incidents") || !map.isSourceLoaded("incidents")) return;
    const features = map.querySourceFeatures("incidents");
    const wanted = new Map<string, maplibregl.Marker>();
    const existing = markersRef.current;

    for (const f of features) {
      const geometry = f.geometry as GeoJSON.Point;
      const [lon, lat] = geometry.coordinates;
      if (f.properties?.cluster) {
        const key = `c:${f.properties.cluster_id}:${f.properties.point_count}`;
        if (wanted.has(key)) continue;
        let marker = existing.get(key);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "gcm-cluster";
          const count = f.properties.point_count as number;
          const size = Math.min(56, 34 + count * 2);
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.textContent = String(count);
          el.setAttribute("aria-label", `Cluster of ${count} incidents. Zoom in to expand.`);
          const clusterId = f.properties.cluster_id as number;
          el.addEventListener("click", async () => {
            const src = map.getSource<maplibregl.GeoJSONSource>("incidents");
            if (!src) return;
            const zoom = await src.getClusterExpansionZoom(clusterId);
            const move = { center: [lon, lat] as [number, number], zoom };
            if (reducedMotion()) map.jumpTo(move);
            else map.easeTo({ ...move, duration: 500 });
          });
          marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
        } else {
          marker.setLngLat([lon, lat]);
        }
        wanted.set(key, marker);
      } else {
        const id = f.properties?.id as string;
        const key = `p:${id}`;
        if (wanted.has(key)) continue;
        let marker = existing.get(key);
        if (!marker) {
          const incident = incidentsRef.current.find((i) => i.id === id);
          if (!incident) continue;
          const meta = CATEGORY_META[incident.category];
          const el = document.createElement("button");
          el.className = "gcm-marker";
          el.style.background = meta.color;
          el.textContent = meta.code;
          el.setAttribute(
            "aria-label",
            `${meta.label}: ${incident.headline}. ${incident.location.name}. Open details.`,
          );
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            openIncident(id);
          });
          marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
        } else {
          marker.setLngLat([lon, lat]);
        }
        wanted.set(key, marker);
      }
    }

    for (const [key, marker] of existing) {
      if (!wanted.has(key)) marker.remove();
    }
    markersRef.current = wanted;
    if (selectedId) {
      wanted.get(`p:${selectedId}`)?.getElement().setAttribute("data-selected", "true");
    }
  }

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    const move = { center: [20, 30] as [number, number], zoom: 1.6, bearing: 0, pitch: 0 };
    if (reducedMotion()) map.jumpTo(move);
    else map.flyTo({ ...move, duration: 800 });
  }

  const stale =
    lastUpdated !== null && Date.now() - new Date(lastUpdated).getTime() > 15 * 60_000;

  const timeChips: { key: TimeKey; label: string }[] = [
    { key: "latest", label: "Latest" },
    { key: "24h", label: "24 h" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="relative min-h-0 flex-1" data-testid="map-screen">
      {/* Map or fallback list */}
      {view === "map" && !webglFailed ? (
        <div
          ref={mapContainer}
          // Inline position: maplibre's own stylesheet sets `.maplibregl-map
          // { position: relative }`, which would override the Tailwind class
          // and collapse the container to zero height.
          style={{ position: "absolute", inset: 0 }}
          aria-label="Interactive world map of incidents. A complete list view is available from the map menu."
          role="application"
          // Background becomes inert while the sheet is fully expanded.
          {...(selected && sheetState === "full" ? { inert: true } : {})}
        />
      ) : (
        <div className="absolute inset-0 overflow-y-auto pt-16">
          {webglFailed ? (
            <p className="px-4 pt-4 text-sm" style={{ color: "var(--muted)" }}>
              Interactive map unavailable on this device — showing the complete
              list instead.
            </p>
          ) : null}
          <p className="px-4 text-[11px]" style={{ color: "var(--muted)" }}>
            {loading
              ? "Loading…"
              : lastUpdated
                ? `Updated ${relativeTime(lastUpdated)}${stale ? " — may be stale" : ""} · ${visible.length} incidents`
                : "No data"}
          </p>
          <MapListView incidents={visible} onSelect={openIncident} />
        </div>
      )}

      {/* Top control row: only Search, Filters, Overflow, Reset on phones. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3"
        {...(selected && sheetState === "full" ? { inert: true } : {})}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="tap chip pointer-events-auto px-4 font-semibold"
              onClick={() => setSearchOpen(true)}
            >
              🔍 Search
            </button>
            <button
              type="button"
              className={`tap chip pointer-events-auto px-4 font-semibold ${cats.size > 0 ? "chip-active" : ""}`}
              aria-expanded={filtersOpen}
              onClick={() => {
                setFiltersOpen((v) => !v);
                setOverflowOpen(false);
              }}
            >
              ⚙ Filters{cats.size > 0 ? ` (${cats.size})` : ""}
            </button>
            <button
              type="button"
              className="tap chip pointer-events-auto px-3 font-semibold"
              aria-label="More map options"
              aria-expanded={overflowOpen}
              onClick={() => {
                setOverflowOpen((v) => !v);
                setFiltersOpen(false);
              }}
            >
              ⋯
            </button>
          </div>
          {/* Time chips inline on larger screens */}
          <div className="hidden gap-1.5 md:flex">
            {timeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`tap chip pointer-events-auto ${timeKey === c.key ? "chip-active" : ""}`}
                aria-pressed={timeKey === c.key}
                onClick={() => setTimeKey(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="tap chip pointer-events-auto px-3 font-semibold"
          aria-label="Reset to world view"
          onClick={resetView}
        >
          ⌂
        </button>
      </div>

      {/* Status line (map view only — the list shows its own) */}
      {view === "map" && !webglFailed ? (
        <div
          className="pointer-events-none absolute left-3 z-20 text-[11px]"
          style={{ bottom: selected ? undefined : "12px", top: selected ? "64px" : undefined }}
        >
          <span className="chip" style={{ opacity: 0.95 }}>
            {loading
              ? "Loading…"
              : lastUpdated
                ? `Updated ${relativeTime(lastUpdated)}`
                : "No data"}
            {stale ? " — may be stale" : ""}
          </span>
        </div>
      ) : null}

      {/* Filters sheet */}
      {filtersOpen ? (
        <div
          className="absolute inset-x-3 top-16 z-40 max-h-[60%] overflow-y-auto rounded-xl border p-3 md:w-96"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          role="group"
          aria-label="Incident filters"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Categories</h2>
            <button
              type="button"
              className="tap chip"
              onClick={() => setCats(new Set())}
              disabled={cats.size === 0}
            >
              Reset all
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INCIDENT_CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const active = cats.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`tap chip ${active ? "chip-active" : ""}`}
                  aria-pressed={active}
                  onClick={() =>
                    setCats((prev) => {
                      const next = new Set(prev);
                      if (next.has(c)) next.delete(c);
                      else next.add(c);
                      return next;
                    })
                  }
                >
                  {meta.code} {meta.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="tap chip mt-3 w-full"
            onClick={() => setFiltersOpen(false)}
          >
            Done
          </button>
        </div>
      ) : null}

      {/* Overflow sheet: time range, layers, list view, legend. */}
      {overflowOpen ? (
        <div
          className="absolute inset-x-3 top-16 z-40 max-h-[70%] overflow-y-auto rounded-xl border p-3 md:w-96"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          role="group"
          aria-label="Map options"
        >
          <h2 className="text-sm font-bold">Time range</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {timeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`tap chip ${timeKey === c.key ? "chip-active" : ""}`}
                aria-pressed={timeKey === c.key}
                onClick={() => setTimeKey(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {timeKey === "custom" ? (
            <div className="mt-3">
              <label htmlFor="time-slider" className="text-xs" style={{ color: "var(--muted)" }}>
                Review window: last {customHours} hours
              </label>
              <input
                id="time-slider"
                type="range"
                min={6}
                max={24 * 30}
                step={6}
                value={customHours}
                onChange={(e) => setCustomHours(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </div>
          ) : null}

          <h2 className="mt-4 text-sm font-bold">Layers & view</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`tap chip ${heat ? "chip-active" : ""}`}
              aria-pressed={heat}
              onClick={() => setHeat((v) => !v)}
            >
              Aggregate heat layer
            </button>
            <button
              type="button"
              className={`tap chip ${view === "list" ? "chip-active" : ""}`}
              aria-pressed={view === "list"}
              onClick={() => {
                setView((v) => (v === "list" ? "map" : "list"));
                setOverflowOpen(false);
              }}
            >
              ☰ List view
            </button>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            The heat layer aggregates delayed incident counts — it does not
            represent military capability or strength.
          </p>

          <h2 className="mt-4 text-sm font-bold">Legend</h2>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {INCIDENT_CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              return (
                <li key={c} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: meta.color }}
                  >
                    {meta.code}
                  </span>
                  {meta.label}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="tap chip mt-3 w-full"
            onClick={() => setOverflowOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}

      {searchOpen ? (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onSelectIncident={(id) => {
            setSearchOpen(false);
            openIncident(id);
          }}
        />
      ) : null}

      {selected ? (
        <IncidentSheet
          incident={selected}
          state={sheetState}
          onStateChange={setSheetState}
          onClose={closeSheet}
          onPrev={() => selectedIndex > 0 && openIncident(visible[selectedIndex - 1].id)}
          onNext={() =>
            selectedIndex < visible.length - 1 && openIncident(visible[selectedIndex + 1].id)
          }
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < visible.length - 1}
        />
      ) : null}
    </div>
  );
}
