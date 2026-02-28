import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'
import { LogOut, Send, CheckCircle } from 'lucide-react'

export function AccessRequestPage() {
  const { user } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const email = user?.email ?? ''
  const displayName = user?.user_metadata?.full_name || email
  const avatarUrl = user?.user_metadata?.avatar_url

  useEffect(() => {
    async function checkExisting() {
      const { data } = await supabase
        .from('access_requests')
        .select('id, status')
        .eq('email', email)
        .single()

      if (data) {
        setSubmitted(true)
      }
      setLoading(false)
    }
    if (email) checkExisting()
  }, [email])

  const handleRequest = async () => {
    setError(null)
    const { error: insertError } = await supabase
      .from('access_requests')
      .insert({
        email,
        display_name: user?.user_metadata?.full_name || null,
        avatar_url: user?.user_metadata?.avatar_url || null,
      })

    if (insertError) {
      if (insertError.code === '23505') {
        setSubmitted(true)
      } else {
        setError('Failed to submit request. Please try again.')
      }
      return
    }
    setSubmitted(true)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center space-y-6 max-w-sm mx-auto px-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-100">StoryMapper</h1>
          <p className="mt-2 text-lg text-gray-400">Lightweight story mapping for agile teams</p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
          )}
          <span className="text-sm text-gray-300">{displayName}</span>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-sm rounded-lg border border-green-800 bg-green-950/50 px-4 py-3 text-sm text-green-300 flex items-center gap-2 justify-center">
              <CheckCircle size={16} />
              Access request submitted. You'll be notified when approved.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto max-w-sm rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-300">
              This app is invite-only. Request access to get started.
            </div>

            {error && (
              <div className="mx-auto max-w-sm rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleRequest}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Send size={16} />
              Request Access
            </button>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  )
}
