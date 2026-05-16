import { useEffect } from 'react'
import { AuthProvider, useAuth } from './components/Auth/AuthProvider'
import { LoginPage } from './components/Auth/LoginPage'
import { AccessRequestPage } from './components/Auth/AccessRequestPage'
import { HomeScreen } from './components/Home/HomeScreen'
import { Board } from './components/Board/Board'
import { Toast } from './components/shared/Toast'
import { StorageWarningBanner } from './components/shared/StorageWarningBanner'
import { ReconnectFolderScreen } from './components/Storage/ReconnectFolderScreen'
import { useStoryMapStore } from './store/useStoryMapStore'
import { createAdapter, createFileSystemAdapter, isLocalMode } from './lib/adapters'
import { isFsaSupported } from './lib/fs/fsaSupport'
import { loadDirectoryHandle } from './lib/storage/fsaHandleStore'
import { resolveStartupStorage } from './lib/fs/resolveStartupStorage'

// Module-level guards: survive every re-render AND StrictMode's
// mount/unmount/remount cycle (a useRef does not survive the remount).
// Storage init must happen exactly once per page load.
let bootStarted = false
// The folder whose access must be re-granted (kept out of React state;
// like `bootStarted` it must survive remount). Set before `needsReconnect`
// flips, so AppContent always sees it on the render that shows the screen.
let pendingHandle: FileSystemDirectoryHandle | null = null

function AppContent() {
  const { user, loading: authLoading, unauthorized } = useAuth()
  const currentMapId = useStoryMapStore((s) => s.currentMapId)
  const storeLoading = useStoryMapStore((s) => s.loading)
  const adapter = useStoryMapStore((s) => s.adapter)
  const needsReconnect = useStoryMapStore((s) => s.needsReconnect)
  const initAdapter = useStoryMapStore((s) => s.initAdapter)

  // Initialise the storage adapter exactly once.
  useEffect(() => {
    if (bootStarted) return
    if (useStoryMapStore.getState().adapter) return
    if (!isLocalMode() && !user) return // Supabase mode: wait for auth

    bootStarted = true
    ;(async () => {
      const plan = await resolveStartupStorage({
        isLocalMode,
        isFsaSupported,
        loadDirectoryHandle,
      })

      if (plan.kind === 'reconnect') {
        pendingHandle = plan.handle
        useStoryMapStore.setState({ needsReconnect: true })
        return
      }
      if (plan.kind === 'fs') {
        await initAdapter(await createFileSystemAdapter(plan.handle), 'fs')
        return
      }
      if (plan.kind === 'supabase') {
        await initAdapter(await createAdapter(), 'supabase')
        return
      }
      // idb (default local) -- possibly with a fallback notice
      await initAdapter(await createAdapter(), 'idb')
      if (plan.notice) useStoryMapStore.setState({ error: plan.notice })
    })().catch((err) => {
      console.error('[StoryMapper] adapter init failed:', err)
      useStoryMapStore.setState({
        error:
          err instanceof Error ? err.message : 'Failed to initialise storage',
      })
    })
  }, [user, initAdapter])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  // A saved folder needs re-granting: show an actionable screen BEFORE
  // the `!adapter` loader, otherwise the app would spin forever (adapter
  // is intentionally still null in this state).
  if (isLocalMode() && needsReconnect && pendingHandle) {
    return <ReconnectFolderScreen handle={pendingHandle} />
  }

  // Show loading while the initial store hydration is in flight.
  if (storeLoading || !adapter) {
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
      <StorageWarningBanner />
      <AppContent />
      <Toast />
    </AuthProvider>
  )
}
