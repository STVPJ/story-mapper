import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { requestFsaPermission } from '../../lib/fs/fsaPermissions'
import { createFileSystemAdapter, createAdapter } from '../../lib/adapters'
import { clearDirectoryHandle } from '../../lib/storage/fsaHandleStore'
import { useStoryMapStore } from '../../store/useStoryMapStore'

/**
 * Shown on cold boot when a saved maps folder exists but the browser
 * needs the user to re-grant access (Chromium does not persist FSA
 * permission across sessions). Rendered BEFORE the `!adapter` loader so
 * the user gets an actionable screen, never an infinite spinner.
 */
export function ReconnectFolderScreen({
  handle,
}: {
  handle: FileSystemDirectoryHandle
}) {
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  const reconnect = async () => {
    setBusy(true)
    setDenied(false)
    const permission = await requestFsaPermission(handle)
    if (permission !== 'granted') {
      setDenied(true)
      setBusy(false)
      return
    }
    const adapter = await createFileSystemAdapter(handle)
    await useStoryMapStore.getState().initAdapter(adapter, 'fs')
    useStoryMapStore.setState({ needsReconnect: false })
  }

  const useBrowserStorage = async () => {
    setBusy(true)
    await clearDirectoryHandle()
    const adapter = await createAdapter()
    await useStoryMapStore.getState().initAdapter(adapter, 'idb')
    useStoryMapStore.setState({ needsReconnect: false })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md text-center space-y-6">
        <FolderOpen size={40} className="mx-auto text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Reconnect your maps folder
          </h1>
          <p className="mt-2 text-gray-400">
            Your story maps live in a folder on your computer. Your browser
            needs you to grant access again for this session.
          </p>
          {denied && (
            <p className="mt-3 text-sm text-amber-400">
              Access was not granted. Try again, or switch to browser storage.
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={reconnect}
            disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
          >
            <FolderOpen size={20} />
            Reconnect folder
          </button>
          <button
            onClick={useBrowserStorage}
            disabled={busy}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            Use browser storage instead
          </button>
        </div>
      </div>
    </div>
  )
}
