/**
 * Persists the user's chosen FSA directory handle in IndexedDB.
 *
 * `FileSystemDirectoryHandle` is structured-cloneable, so IndexedDB can
 * store it natively (the canonical handle-persistence pattern). This
 * lives in its own keyless store (`fsHandles`) alongside the maps store,
 * sharing the single bounded open/upgrade path via `getRawDb()`.
 *
 * Same discipline as the maps wrapper: every step is time-bounded, and
 * these functions never reject and never hang -- worst case they resolve
 * `null` / no-op. A missing or unreachable handle store is NOT a
 * maps-storage failure, so this never triggers in-memory mode.
 */

import { getRawDb } from './IndexedDB'

const HANDLE_STORE = 'fsHandles'
const HANDLE_KEY = 'dir'
const TIMEOUT_MS = 3000

/** Resolve a request, or `null` if it errors or does not respond in time. */
function settle<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (v: T | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), TIMEOUT_MS)
    request.onsuccess = () => finish(request.result)
    request.onerror = () => finish(null)
  })
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await getRawDb()
  if (!db) return
  try {
    await settle(
      db
        .transaction(HANDLE_STORE, 'readwrite')
        .objectStore(HANDLE_STORE)
        .put(handle, HANDLE_KEY)
    )
  } catch {
    /* never throws -- handle simply isn't persisted this session */
  }
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await getRawDb()
  if (!db) return null
  try {
    const result = await settle<FileSystemDirectoryHandle>(
      db
        .transaction(HANDLE_STORE, 'readonly')
        .objectStore(HANDLE_STORE)
        .get(HANDLE_KEY)
    )
    return result ?? null
  } catch {
    return null
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await getRawDb()
  if (!db) return
  try {
    await settle(
      db
        .transaction(HANDLE_STORE, 'readwrite')
        .objectStore(HANDLE_STORE)
        .delete(HANDLE_KEY)
    )
  } catch {
    /* never throws */
  }
}
