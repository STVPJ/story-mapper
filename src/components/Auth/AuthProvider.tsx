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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const allowed = await checkAllowlist(session)
          setUnauthorized(!allowed)
        } catch {
          setUnauthorized(true)
        }
      }
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const allowed = await checkAllowlist(session)
        setUnauthorized(!allowed)
      } else {
        setUnauthorized(false)
      }
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, unauthorized }}>
      {children}
    </AuthContext.Provider>
  )
}
