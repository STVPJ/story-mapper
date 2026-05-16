import type { StorageAdapter } from './StorageAdapter'

export type { StorageAdapter }

/**
 * Resolve the correct storage adapter based on environment variables.
 *
 * - If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set,
 *   we use the SupabaseAdapter (cloud mode).
 * - Otherwise, we use the LocalStorageAdapter (local-first default).
 */
export async function createAdapter(): Promise<StorageAdapter> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    const { SupabaseAdapter } = await import('./SupabaseAdapter')
    return new SupabaseAdapter(supabaseUrl, supabaseKey)
  }

  const { LocalStorageAdapter } = await import('./LocalStorageAdapter')
  return new LocalStorageAdapter()
}

/** True when running in local-first mode (no Supabase configured). */
export function isLocalMode(): boolean {
  return !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
}
