import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'
import { LogOut, ChevronDown, Shield } from 'lucide-react'
import { AdminPanel } from '../Admin/AdminPanel'

export function UserMenu() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const isAdmin = user?.id === import.meta.env.VITE_ADMIN_USER_ID

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    async function fetchPendingCount() {
      const { count } = await supabase
        .from('access_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      setPendingCount(count ?? 0)
    }
    fetchPendingCount()
  }, [showAdmin, isAdmin])

  if (!user) return null

  const avatarUrl = user.user_metadata?.avatar_url
  const displayName = user.user_metadata?.full_name || user.email || 'User'

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full" />
          )}
          <span className="text-sm font-medium text-gray-300">{displayName}</span>
          <ChevronDown size={14} className="text-gray-500" />
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
            {isAdmin && (
              <button
                onClick={() => {
                  setShowAdmin(true)
                  setOpen(false)
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                <div className="relative">
                  <Shield size={14} />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                </div>
                Manage Access
                {pendingCount > 0 && (
                  <span className="ml-auto text-xs text-amber-400">{pendingCount}</span>
                )}
              </button>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                setOpen(false)
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </>
  )
}
