import { useEffect } from 'react'
import { AuthProvider, useAuth } from './components/Auth/AuthProvider'
import { LoginPage } from './components/Auth/LoginPage'
import { AccessRequestPage } from './components/Auth/AccessRequestPage'
import { HomeScreen } from './components/Home/HomeScreen'
import { Board } from './components/Board/Board'
import { Toast } from './components/shared/Toast'
import { useStoryMapStore } from './store/useStoryMapStore'
import { createAdapter, isLocalMode } from './lib/adapters'

function AppContent() {
  const { user, loading: authLoading, unauthorized } = useAuth()
  const currentMapId = useStoryMapStore((s) => s.currentMapId)
  const storeLoading = useStoryMapStore((s) => s.loading)
  const adapter = useStoryMapStore((s) => s.adapter)
  const initAdapter = useStoryMapStore((s) => s.initAdapter)

  // Initialise the storage adapter once auth is ready
  useEffect(() => {
    if (adapter) return // already initialised
    if (!isLocalMode() && !user) return // Supabase mode: wait for auth

    createAdapter().then((a) => initAdapter(a))
  }, [user, adapter, initAdapter])

  // Show loading while auth or store is bootstrapping
  if (authLoading || storeLoading || !adapter) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  // In Supabase mode, gate on authentication
  if (!isLocalMode()) {
    if (!user) return <LoginPage />
    if (unauthorized) return <AccessRequestPage />
  }

  return currentMapId ? <Board /> : <HomeScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toast />
    </AuthProvider>
  )
}
