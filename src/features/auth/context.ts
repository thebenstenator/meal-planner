import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

import type { Credentials } from '@/schemas/auth';

/**
 * Google OAuth is intentionally deferred (see docs/decisions/0002). Flipping
 * this to true — after adding the Google client id/secret to supabase auth
 * config — is all that's needed to light up the button in the UI.
 */
export const GOOGLE_OAUTH_ENABLED = false;

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session has been resolved. */
  loading: boolean;
  signUp: (creds: Credentials, name?: string) => Promise<void>;
  signIn: (creds: Credentials) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
