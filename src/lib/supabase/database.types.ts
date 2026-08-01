/**
 * PLACEHOLDER — regenerate with `npm run db:types` once the local Supabase
 * stack is running and migrations exist (Slice 1 onward). Committed so the
 * Supabase client is typed from day one. Do not hand-edit.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
