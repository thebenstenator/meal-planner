import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/config/env';
import type { Database } from '@/lib/supabase/database.types';

/**
 * The one Supabase browser client. The anon key is public by design; all data
 * isolation is enforced by Row Level Security at the database layer (see
 * 02-tech-stack.md and the RLS pattern in 03-data-model.md).
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
