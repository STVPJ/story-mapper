import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContext {
  session: Session | null
  user: User | null
  loading: boolean
  unauthorized: boolean
}

const AuthContext = createContext<AuthContext>({ session: null, user: null, loading: true, unauthorized: false })

export function useAuth() {
  return useContext(AuthContext)
}

const isDevBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

async function checkAllowlist(session: Session): Promise<boolean> {
  if (isDevBypass) return true
  const { data } = await supabase
    .from('allowed_users')
    .select('id')
    .eq('email', session.user.email ?? '')
    .single()
  return !!data
}

async function initSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    return { session: null, unauthorized: false }
  }
  // If the access token is expired, try to refresh before checking allowlist
  const expiresAt = session.expires_at ?? 0
  if (expiresAt * 1000 < Date.now()) {
    const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed) {
      await supabase.auth.signOut()
      return { session: null, unauthorized: false }
    }
    const allowed = await checkAllowlist(refreshed)
    return { session: refreshed, unauthorized: !allowed }
  }
  const allowed = await checkAllowlist(session)
  return { session, unauthorized: !allowed }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    initSession()
      .then(({ session, unauthorized }) => {
        setSession(session)
        setUnauthorized(unauthorized)
      })
      .catch(() => {
        setSession(null)
        setUnauthorized(false)
      })
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          const allowed = await checkAllowlist(session)
          setUnauthorized(!allowed)
        } catch {
          setUnauthorized(true)
        }
      } else {
        setUnauthorized(false)
      }
      setSession(session)
    })

    // Re-validate session when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initSession().then(({ session, unauthorized }) => {
          setSession(session)
          setUnauthorized(unauthorized)
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, unauthorized }}>
      {children}
    </AuthContext.Provider>
  )
}
