import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

import type { Credentials } from '@/schemas/auth';

/**
 * Lights up the "Continue with Google" button. The client side (signInWithGoogle
 * below) has always been implemented; this gate stayed off until the Google
 * client id/secret were added to the Supabase project's auth config (see
 * docs/decisions/0002). Keep this false in any environment where that provider
 * config isn't in place, or the button will 400 on click.
 */
export const GOOGLE_OAUTH_ENABLED = true;

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session has been resolved. */
  loading: boolean;
  signUp: (creds: Credentials, name?: string) => Promise<void>;
  signIn: (creds: Credentials) => Promise<void>;
  /** Update the signed-in user's display name (auth metadata). */
  updateName: (name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
