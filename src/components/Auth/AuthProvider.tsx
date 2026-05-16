import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isLocalMode } from '../../lib/adapters'

interface AuthContext {
  user: { id: string; email: string; user_metadata?: { full_name?: string; avatar_url?: string; [key: string]: unknown } } | null
  loading: boolean
  unauthorized: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContext>({
  user: null,
  loading: true,
  unauthorized: false,
  signOut: async () => {},
})

// eslint-disable-next-line react-refresh/only-export-components -- context hook colocated with provider by design
export function useAuth() {
  return useContext(AuthContext)
}

/* ---- local-mode provider (no auth needed) ---- */

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const localUser = {
    id: 'local',
    email: 'local@localhost',
    user_metadata: { full_name: 'Local User', avatar_url: '' },
  }

  return (
    <AuthContext.Provider value={{ user: localUser, loading: false, unauthorized: false, signOut: async () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

/* ---- Supabase-mode provider (cloud auth) ---- */

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Dynamic import so Supabase is only loaded in cloud mode
        const { SupabaseAdapter } = await import('../../lib/adapters/SupabaseAdapter')
        const adapter = new SupabaseAdapter(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        )
        const client = adapter.client

        const { data: { session: s } } = await client.auth.getSession()
        if (cancelled) return

        if (!s) {
          setSession(null)
          setLoading(false)
          return
        }

        // Check allowlist
        const { data: allowed } = await client
          .from('allowed_users')
          .select('id')
          .eq('email', s.user.email ?? '')
          .single()

        if (!cancelled) {
          setSession(s)
          setUnauthorized(!allowed)
          setLoading(false)
        }

        // Listen for auth changes
        client.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession) {
            const { data: a } = await client
              .from('allowed_users')
              .select('id')
              .eq('email', newSession.user.email ?? '')
              .single()
            setUnauthorized(!a)
          } else {
            setUnauthorized(false)
          }
          setSession(newSession)
        })
      } catch {
        if (!cancelled) {
          setSession(null)
          setLoading(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? '',
        user_metadata: session.user.user_metadata,
      }
    : null

  const signOut = async () => {
    try {
      const { SupabaseAdapter } = await import('../../lib/adapters/SupabaseAdapter')
      const adapter = new SupabaseAdapter(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      await adapter.client.auth.signOut()
    } catch { /* ignore */ }
  }

  return (
    <AuthContext.Provider value={{ user, loading, unauthorized, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

/* ---- main export: picks the right provider ---- */

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isLocalMode()) {
    return <LocalAuthProvider>{children}</LocalAuthProvider>
  }
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}
