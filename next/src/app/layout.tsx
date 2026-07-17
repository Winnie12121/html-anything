import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Industry Insight Studio",
  description:
    "A local-first workspace for collecting industry data and generating editable HTML insight reports.",
  metadataBase: new URL("https://html-anything.app"),
  openGraph: {
    title: "Industry Insight Studio",
    description: "Collect, organize, and transform industry data into editable HTML insight reports.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body
        className="min-h-full bg-[var(--paper)] text-[var(--ink)] selection:bg-[var(--accent)]/20"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
