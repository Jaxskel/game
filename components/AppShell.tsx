"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { DemoBanner } from "./DemoBanner";

const DESTINATIONS = [
  { href: "/", label: "Map", glyph: "🗺" },
  { href: "/feed", label: "Feed", glyph: "📰" },
  { href: "/briefings", label: "Briefings", glyph: "📋" },
  { href: "/watchlist", label: "Watchlist", glyph: "★" },
  { href: "/settings", label: "Settings", glyph: "⚙" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/incident");
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * App shell: persistent bottom navigation on phones, a navigation rail from
 * md up. Content sits between the demo banner and the nav; pages that need
 * the nav height use --nav-h.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Apply the stored theme on first paint of any route (also done inline in
    // layout <head> to avoid a flash; this keeps client navigation honest).
    const stored = window.localStorage.getItem("gcm.theme");
    const theme = stored ? JSON.parse(stored) : "system";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--surface)] focus:p-3"
      >
        Skip to content
      </a>

      {/* Navigation rail (tablet/desktop) */}
      <nav
        aria-label="Primary"
        className="hidden md:flex md:w-56 md:flex-col md:gap-1 md:border-r md:p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="px-3 py-4">
          <span className="text-sm font-bold tracking-wide">
            Global Conflict Monitor
          </span>
        </div>
        {DESTINATIONS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            aria-current={isActive(pathname, d.href) ? "page" : undefined}
            className="tap justify-start gap-3 rounded-lg px-3 text-sm"
            style={
              isActive(pathname, d.href)
                ? { background: "var(--surface-2)", fontWeight: 700 }
                : undefined
            }
          >
            <span aria-hidden="true">{d.glyph}</span>
            {d.label}
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <main
          id="main"
          className="flex min-h-0 flex-1 flex-col"
          style={{ paddingBottom: "var(--nav-h, 0px)" }}
        >
          {children}
        </main>
      </div>

      {/* Bottom navigation (phones) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t md:hidden"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          paddingBottom: "var(--sab)",
        }}
      >
        {DESTINATIONS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            aria-current={isActive(pathname, d.href) ? "page" : undefined}
            className="tap flex-1 flex-col gap-0.5 py-1 text-[11px]"
            style={
              isActive(pathname, d.href)
                ? { color: "var(--accent)", fontWeight: 700 }
                : { color: "var(--muted)" }
            }
          >
            <span aria-hidden="true" className="text-base leading-5">
              {d.glyph}
            </span>
            {d.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
