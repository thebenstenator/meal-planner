import { create } from 'zustand';

import { applyTheme, getStoredTheme, storeTheme, type Theme } from '@/app/theme';

/**
 * Client-only UI state (Zustand). Server state does NOT belong here — that lives
 * in TanStack Query. This is for ephemeral, cross-component UI concerns such as
 * the active household selection, theme, and sync-status banners.
 *
 * Skeleton for Slice 0; grows as features land.
 */
interface UiState {
  theme: Theme;
  /** The household whose data is currently in view. Set after auth in Slice 1. */
  activeHouseholdId: string | null;
  setTheme: (theme: Theme) => void;
  setActiveHouseholdId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Seed from the persisted choice so the toggle reflects reality on load; the
  // inline boot script has already applied the class to avoid a flash.
  theme: getStoredTheme(),
  activeHouseholdId: null,
  setTheme: (theme) => {
    storeTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
  setActiveHouseholdId: (activeHouseholdId) => set({ activeHouseholdId }),
}));
