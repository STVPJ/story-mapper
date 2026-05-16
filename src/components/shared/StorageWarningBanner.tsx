import { useState, useSyncExternalStore } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import {
  isMemoryMode,
  subscribeMemoryMode,
} from '../../lib/storage/IndexedDB'

/**
 * Persistent warning shown when local storage has fallen back to the
 * non-persistent in-memory store (private/locked-down browsers, blocked
 * site storage, an unresponsive IndexedDB). Without this, the fallback is
 * silent and the user loses their work on refresh with no indication.
 */
export function StorageWarningBanner() {
  const memoryMode = useSyncExternalStore(subscribeMemoryMode, isMemoryMode)
  const [dismissed, setDismissed] = useState(false)

  if (!memoryMode || dismissed) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 flex items-start gap-3 bg-amber-500 text-amber-950 px-4 py-3 shadow-md"
    >
      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
      <p className="text-sm flex-1">
        <strong>Storage unavailable.</strong> Your maps are kept in memory for
        this session only and <strong>won't be saved</strong> &mdash; they will
        be lost on refresh or tab close. Use <strong>Export (JSON)</strong> to
        save your work.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 hover:bg-amber-600/40 rounded p-0.5"
      >
        <X size={16} />
      </button>
    </div>
  )
}
