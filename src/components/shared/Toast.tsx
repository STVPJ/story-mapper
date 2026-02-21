import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'

export function Toast() {
  const error = useStoryMapStore((s) => s.error)
  const setError = useStoryMapStore((s) => s.setError)

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  if (!error) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
      <p className="text-sm">{error}</p>
      <button onClick={() => setError(null)} className="shrink-0 hover:bg-red-700 rounded p-0.5">
        <X size={16} />
      </button>
    </div>
  )
}
