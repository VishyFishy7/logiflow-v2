"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/spectrumui/sonner";
import { TooltipProvider } from "@/components/spectrumui/tooltip";
import { isForbidden } from "@/lib/api/client";
import { API_MODE } from "@/lib/env";

/**
 * §17.2 Deployment modes. In `mock` mode the app is served entirely from the
 * browser: MSW intercepts `/api/v1/*` using the handlers generated from the
 * shared route table, so every screen is demoable with no server and no
 * database. In `live` mode the same client hits the real route handlers.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // A 403 is a decision, not a blip — retrying it just burns latency (§9.9).
  if (isForbidden(error)) return false;
  return failureCount < 1;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Lists stay on screen while the next page loads — no full-page flash.
        placeholderData: (previous: unknown) => previous,
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Boots the mock backend before the first query runs. Waiting here (instead of
 * letting queries fail and retry) is what keeps mock mode flicker-free.
 */
function useMockBackend(): boolean {
  const [ready, setReady] = useState(API_MODE !== "mock");

  useEffect(() => {
    if (API_MODE !== "mock") return;
    let cancelled = false;
    (async () => {
      const { worker } = await import("@/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass", quiet: true });
      if (!cancelled) setReady(true);
    })().catch((error) => {
      console.error("[logiflow] mock backend failed to start", error);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const mockReady = useMockBackend();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={150}>
          {mockReady ? children : <BootSplash />}
          <Toaster position="top-right" closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** Shown for the few milliseconds MSW needs to register its handler. */
function BootSplash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-sm">Starting demo workspace…</span>
      </div>
    </div>
  );
}
