"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * §4.3 UI state. Deliberately tiny: server data lives in React Query, list
 * filters live in the URL (§11.5), and the theme lives in next-themes. The
 * only things left that are genuinely client-only are the ones below.
 */
export interface UiState {
  /** Desktop sidebar rail state. Persisted so the choice survives a reload. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** The ⌘K palette. */
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  /** The notification drawer behind the topbar bell. */
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;

  /** Mobile "More" sheet (bottom tab bar → everything else). */
  mobileMoreOpen: boolean;
  setMobileMoreOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

      notificationsOpen: false,
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),

      mobileMoreOpen: false,
      setMobileMoreOpen: (mobileMoreOpen) => set({ mobileMoreOpen }),
    }),
    {
      name: "logiflow.ui",
      // Only the rail state is worth remembering.
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
