import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { PresentationShell } from "@/components/presentation/presentation-shell";
import { ThemeProvider } from "@/components/system/theme-provider";

export const metadata: Metadata = {
  title: "工作台",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AppShell>
        <PresentationShell>{children}</PresentationShell>
      </AppShell>
    </ThemeProvider>
  );
}