import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_REF = 'dbqogkfrbvlvftoeydgq';
export const DEFAULT_SUPABASE_URL = 'https://dbqogkfrbvlvftoeydgq.supabase.co';

const envUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) ||
  DEFAULT_SUPABASE_URL;

const envAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)) ||
  '';

export const supabaseUrl: string = envUrl;
export const supabaseAnonKey: string = envAnonKey;

/**
 * Lazy-initialized Supabase client.
 * Returns null if the publishable anon key has not been provided yet in environment variables.
 */
let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseAnonKey) {
    return null;
  }
  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
    });
  }
  return _supabaseClient;
}
