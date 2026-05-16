import { useCallback, useState } from 'react'
import type { StoryMap } from '../../types'
import { isFsaSupported } from '../../lib/fs/fsaSupport'
import { createFileSystemAdapter } from '../../lib/adapters'
import { saveDirectoryHandle } from '../../lib/storage/fsaHandleStore'
import { useStoryMapStore } from '../../store/useStoryMapStore'

type Choice = 'merge' | 'folder' | 'cancel'

interface Conflict {
  folderCount: number
  currentCount: number
  resolve: (choice: Choice) => void
}

interface PickerWindow {
  showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** current wins on an id clash */
function mergeById(folderMaps: StoryMap[], currentMaps: StoryMap[]): StoryMap[] {
  const byId = new Map<string, StoryMap>()
  for (const m of folderMaps) byId.set(m.id, m)
  for (const m of currentMaps) byId.set(m.id, m)
  return [...byId.values()]
}

/**
 * Opt-in to folder (FSA) storage. The user picks a directory; current
 * maps are migrated into it (or reconciled if it already has maps), the
 * handle is persisted, and the adapter is hot-swapped. IndexedDB stays
 * the default until this is invoked.
 */
export function useFolderStorageOptIn() {
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<Conflict | null>(null)

  const enable = useCallback(async () => {
    if (!isFsaSupported()) return

    let dir: FileSystemDirectoryHandle
    try {
      dir = await (window as unknown as PickerWindow).showDirectoryPicker({
        mode: 'readwrite',
      })
    } catch (err) {
      if (isAbort(err)) return // user cancelled the picker -- no-op
      throw err
    }

    setBusy(true)
    try {
      const adapter = await createFileSystemAdapter(dir)
      const folderMaps = await adapter.init()
      const currentMaps = useStoryMapStore.getState().storyMaps

      let finalMaps: StoryMap[]
      let mapsToWrite: StoryMap[]

      if (folderMaps.length > 0) {
        const choice = await new Promise<Choice>((resolve) =>
          setConflict({
            folderCount: folderMaps.length,
            currentCount: currentMaps.length,
            resolve,
          })
        )
        setConflict(null)
        if (choice === 'cancel') {
          setBusy(false)
          return
        }
        if (choice === 'folder') {
          finalMaps = folderMaps
          mapsToWrite = [] // already on disk
        } else {
          finalMaps = mergeById(folderMaps, currentMaps)
          mapsToWrite = finalMaps
        }
      } else {
        finalMaps = currentMaps
        mapsToWrite = currentMaps
      }

      for (const map of mapsToWrite) await adapter.createMap(map)
      await saveDirectoryHandle(dir)
      useStoryMapStore.getState().swapAdapter(adapter, finalMaps)
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported: isFsaSupported(), busy, enable, conflict }
}
