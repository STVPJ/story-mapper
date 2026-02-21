import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './mockSupabase'

const isDevBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

if (import.meta.env.PROD && isDevBypass) {
  throw new Error('VITE_DEV_BYPASS_AUTH must not be enabled in production builds')
}

export const supabase = isDevBypass
  ? (mockSupabase as unknown as ReturnType<typeof createClient>)
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
