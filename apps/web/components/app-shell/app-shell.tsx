"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig, motion } from "motion/react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { MobileTabbar } from "@/components/app-shell/mobile-tabbar";
import { NotificationsDrawer } from "@/components/app-shell/notifications-drawer";
import { Topbar } from "@/components/app-shell/topbar";
import { Skeleton } from "@/components/spectrumui/skeleton";
import { useSession } from "@/lib/api/queries";
import { useUiStore } from "@/lib/store";

/**
 * §11.1 The application shell: one sidebar, one topbar, one content well. Every
 * authenticated screen renders inside it, so navigation, the palette and the
 * notification drawer exist exactly once.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPending, isError } = useSession();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);

  // An expired or absent session sends you to the sign-in screen (§7.4).
  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  // ⌘K / Ctrl-K from anywhere. Escape is handled by the palette itself.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPaletteOpen]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="min-h-dvh bg-background"
        style={{ ["--sidebar-w" as string]: collapsed ? "4.5rem" : "15.5rem" }}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-lg"
        >
          Skip to content
        </a>

        <AppSidebar />

        <div className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 ease-out lg:pl-[var(--sidebar-w)]">
          <Topbar />
          <main id="main" className="flex-1 pb-24 lg:pb-8">
            <div className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 sm:py-7">
              {isPending ? (
                <ShellSkeleton />
              ) : (
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {children}
                </motion.div>
              )}
            </div>
          </main>
        </div>

        <CommandPalette />
        <NotificationsDrawer />
        <MobileTabbar />
      </div>
    </MotionConfig>
  );
}

/** First paint, before the session lands: the shape of a page, not a blank screen. */
function ShellSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading workspace">
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
