import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { SWRegister } from "@/components/SWRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Global Conflict Monitor",
    template: "%s · Global Conflict Monitor",
  },
  description:
    "A clear, safety-gated worldwide view of conflicts, diplomacy, humanitarian developments, and official addresses — from attributed public sources.",
  applicationName: "Global Conflict Monitor",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Conflict Monitor" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
  ],
};

/** Applies the stored theme before first paint to avoid a flash. */
const themeBootstrap = `try{var t=JSON.parse(localStorage.getItem("gcm.theme")||'"system"');document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <SWRegister />
      </body>
    </html>
  );
}
