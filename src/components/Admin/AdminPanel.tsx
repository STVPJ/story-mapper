import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Check, Ban } from 'lucide-react'

interface AccessRequest {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  status: string
  created_at: string
}

interface AdminPanelProps {
  onClose: () => void
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setRequests(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleApprove = async (request: AccessRequest) => {
    const { error: insertError } = await supabase
      .from('allowed_users')
      .insert({ email: request.email })

    // Ignore duplicate key (23505) — email already allowed
    if (insertError && insertError.code !== '23505') return

    await supabase
      .from('access_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', request.id)

    setRequests((prev) =>
      prev.map((r) =>
        r.id === request.id ? { ...r, status: 'approved' } : r
      )
    )
  }

  const handleDeny = async (request: AccessRequest) => {
    await supabase
      .from('access_requests')
      .update({ status: 'denied', reviewed_at: new Date().toISOString() })
      .eq('id', request.id)

    setRequests((prev) =>
      prev.map((r) =>
        r.id === request.id ? { ...r, status: 'denied' } : r
      )
    )
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const reviewed = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="bg-gray-900 w-full max-w-md h-full shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Manage Access</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loading && (
            <p className="text-sm text-gray-500 text-center py-4 animate-pulse">Loading...</p>
          )}

          {!loading && requests.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No access requests yet.
            </p>
          )}

          {pending.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending ({pending.length})
              </h3>
              {pending.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onApprove={() => handleApprove(request)}
                  onDeny={() => handleDeny(request)}
                />
              ))}
            </div>
          )}

          {reviewed.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reviewed ({reviewed.length})
              </h3>
              {reviewed.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RequestCard({
  request,
  onApprove,
  onDeny,
}: {
  request: AccessRequest
  onApprove?: () => void
  onDeny?: () => void
}) {
  const date = new Date(request.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
      <div className="flex items-center gap-3">
        {request.avatar_url ? (
          <img src={request.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-600 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">
            {request.display_name || request.email}
          </p>
          <p className="text-xs text-gray-500 truncate">{request.email}</p>
        </div>
        <span className="text-xs text-gray-600 shrink-0">{date}</span>
      </div>

      {request.status === 'pending' && onApprove && onDeny && (
        <div className="flex gap-2 mt-3 pl-11">
          <button
            onClick={onApprove}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-900/50 text-green-300 rounded-md hover:bg-green-900/70 transition-colors"
          >
            <Check size={12} />
            Approve
          </button>
          <button
            onClick={onDeny}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-900/50 text-red-300 rounded-md hover:bg-red-900/70 transition-colors"
          >
            <Ban size={12} />
            Deny
          </button>
        </div>
      )}

      {request.status === 'approved' && (
        <div className="mt-2 pl-11">
          <span className="text-xs text-green-400">Approved</span>
        </div>
      )}

      {request.status === 'denied' && (
        <div className="mt-2 pl-11">
          <span className="text-xs text-red-400">Denied</span>
        </div>
      )}
    </div>
  )
}
