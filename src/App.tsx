import { AuthProvider, useAuth } from './components/Auth/AuthProvider'
import { LoginPage } from './components/Auth/LoginPage'
import { AccessRequestPage } from './components/Auth/AccessRequestPage'
import { HomeScreen } from './components/Home/HomeScreen'
import { Board } from './components/Board/Board'
import { Toast } from './components/shared/Toast'
import { useStoryMapStore } from './store/useStoryMapStore'

function AppContent() {
  const { user, loading, unauthorized } = useAuth()
  const currentMapId = useStoryMapStore((s) => s.currentMapId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (unauthorized) return <AccessRequestPage />

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
