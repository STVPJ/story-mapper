import { supabase } from '../../lib/supabase'
import { Github } from 'lucide-react'

export function LoginPage() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'github' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-100">StoryMapper</h1>
          <p className="mt-2 text-lg text-gray-400">Lightweight story mapping for agile teams</p>
        </div>
        <button
          onClick={handleLogin}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          <Github size={20} />
          Sign in with GitHub
        </button>
      </div>
    </div>
  )
}
