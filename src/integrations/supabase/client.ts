import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!envSupabaseUrl || !envSupabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (VITE_SUPABASE_PUBLISHABLE_KEY) environment variable.");
}

export const supabase = createClient<Database>(envSupabaseUrl, envSupabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});