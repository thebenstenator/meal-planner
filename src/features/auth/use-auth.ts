import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/features/auth/context';

/** Access the current auth session and auth actions. Must be under AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
