import { useEffect } from 'react'
import { AuthProvider, useAuth } from './components/Auth/AuthProvider'
import { LoginPage } from './components/Auth/LoginPage'
import { AccessRequestPage } from './components/Auth/AccessRequestPage'
import { HomeScreen } from './components/Home/HomeScreen'
import { Board } from './components/Board/Board'
import { Toast } from './components/shared/Toast'
import { useStoryMapStore } from './store/useStoryMapStore'
import { createAdapter, isLocalMode } from './lib/adapters'

// Module-level guard: survives every re-render AND StrictMode's
// mount/unmount/remount cycle (a useRef does not survive the remount).
// Storage init must happen exactly once per page load.
let bootStarted = false

function AppContent() {
  const { user, loading: authLoading, unauthorized } = useAuth()
  const currentMapId = useStoryMapStore((s) => s.currentMapId)
  const storeLoading = useStoryMapStore((s) => s.loading)
  const adapter = useStoryMapStore((s) => s.adapter)
  const initAdapter = useStoryMapStore((s) => s.initAdapter)

  // Initialise the storage adapter exactly once.
  useEffect(() => {
    if (bootStarted) return
    if (useStoryMapStore.getState().adapter) return
    if (!isLocalMode() && !user) return // Supabase mode: wait for auth

    bootStarted = true
    createAdapter()
      .then((a) => initAdapter(a))
      .catch((err) => {
        console.error('[StoryMapper] adapter init failed:', err)
        useStoryMapStore.setState({
          error:
            err instanceof Error ? err.message : 'Failed to initialise storage',
        })
      })
  }, [user, initAdapter])

  // Show loading while auth or the initial store hydration is in flight.
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
