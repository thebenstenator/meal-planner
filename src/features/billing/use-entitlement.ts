import { useHousehold } from '@/features/household/use-household';

export interface Entitlement {
  /** Whether the active household has premium (the AI + smart-layer features). */
  isPremium: boolean;
  isLoading: boolean;
}

/**
 * The single source of truth for premium access. Read from here everywhere —
 * never scatter `isPremium` checks. The AI *limit* is still enforced
 * server-side in the meter (this hook only drives UI: soft gates and paywall
 * prompts). Defaults to non-premium while loading so gated UI stays closed.
 */
export function useEntitlement(): Entitlement {
  const { household, isLoading } = useHousehold();
  return { isPremium: household?.isPremium ?? false, isLoading };
}
