import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeScript } from "@/components/system/theme-script";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: "爆擎 BlastForge",
    template: "%s · 爆擎 BlastForge",
  },
  description: "AI 原生爆破工程辅助决策与协同平台",
  applicationName: "爆擎 BlastForge",
  authors: [{ name: "BlastForge Team" }],
  icons: {
    icon: [{ url: "/Icon.ico", sizes: "any" }],
    shortcut: [{ url: "/Icon.ico", sizes: "any" }],
    apple: [{ url: "/Icon.jpg" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F14" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}