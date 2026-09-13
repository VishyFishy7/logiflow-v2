import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";

/**
 * §11.1 Every authenticated surface lives under this segment, so the shell
 * (sidebar, topbar, palette, notification drawer) mounts once for the whole
 * session and page files stay about their own content.
 */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
