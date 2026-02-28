import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './mockSupabase'

const isDevBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export const supabase = isDevBypass
  ? (mockSupabase as unknown as ReturnType<typeof createClient>)
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
