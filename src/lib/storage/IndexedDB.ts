/**
 * Thin IndexedDB wrapper for StoryMapper local persistence.
 *
 * Stores one record per story map using the map's UUID as key.
 * Each record is the full StoryMap object (features, epics, stories,
 * releases included) so there is a single read on startup and a
 * single write per mutation -- no joins or relational queries needed.
 *
 * Resilience: IndexedDB can be unavailable OR unresponsive (private
 * windows, blocked storage, a second tab holding an upgrade, some
 * locked-down corporate browser policies). The failure mode is nasty:
 * `indexedDB.open` -- or even a later transaction request -- can hang
 * with no `success`/`error`/`blocked` event ever firing, which would
 * freeze the app forever.
 *
 * To make that impossible, EVERY IndexedDB interaction is bounded by a
 * timeout. At startup we open the DB and run a probe read; if either
 * step does not complete in time we permanently switch to an in-memory
 * store so the app stays usable for the session (data is not persisted
 * -- the user is warned and can still export to JSON).
 */

import type { StoryMap } from '../../types'

const DB_NAME = 'story-mapper'
const DB_VERSION = 1
const STORE_NAME = 'maps'

/** Max time any single IndexedDB step (open or request) may take. */
const IDB_TIMEOUT_MS = 3000

let memoryMode = false
const memory = new Map<string, StoryMap>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function enterMemoryMode() {
  if (memoryMode) return
  memoryMode = true
  console.warn(
    '[StoryMapper] IndexedDB is unavailable or unresponsive, so maps are ' +
      'kept in memory for this session only and will NOT survive a refresh ' +
      'or tab close. Use Export (JSON) to save your work.'
  )
}

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
    const timer = setTimeout(() => finish(null), IDB_TIMEOUT_MS)
    request.onsuccess = () => finish(request.result)
    request.onerror = () => finish(null)
  })
}

/**
 * Open the database and prove it can actually serve a read. Resolves a
 * usable DB handle, or `null` if anything is unavailable / unresponsive.
 * Never rejects and never hangs.
 */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      resolve(null)
      return
    }

    let settled = false
    const finish = (db: IDBDatabase | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(db)
    }
    const timer = setTimeout(() => finish(null), IDB_TIMEOUT_MS)

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      finish(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onerror = () => finish(null)
    request.onblocked = () => finish(null)
    request.onsuccess = () => {
      const db = request.result
      // Probe: a real read must complete, otherwise transactions on this
      // connection hang and we must fall back before the app waits on one.
      let probe: IDBRequest
      try {
        probe = db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .count()
      } catch {
        finish(null)
        return
      }
      const probeTimer = setTimeout(() => finish(null), IDB_TIMEOUT_MS)
      probe.onsuccess = () => {
        clearTimeout(probeTimer)
        finish(db)
      }
      probe.onerror = () => {
        clearTimeout(probeTimer)
        finish(null)
      }
    }
  })
}

async function getDb(): Promise<IDBDatabase | null> {
  if (memoryMode) return null
  if (!dbPromise) dbPromise = openDb()
  const db = await dbPromise
  if (!db) {
    enterMemoryMode()
    return null
  }
  return db
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

/* ---- public API (every path is bounded; never hangs) ---- */

export async function getAllMaps(): Promise<StoryMap[]> {
  const db = await getDb()
  let maps: StoryMap[]
  if (db) {
    try {
      const result = await settle<StoryMap[]>(store(db, 'readonly').getAll())
      if (result === null) {
        enterMemoryMode()
        maps = [...memory.values()]
      } else {
        maps = result
      }
    } catch {
      enterMemoryMode()
      maps = [...memory.values()]
    }
  } else {
    maps = [...memory.values()]
  }
  return maps.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

export async function getMap(id: string): Promise<StoryMap | undefined> {
  const db = await getDb()
  if (!db) return memory.get(id)
  try {
    const result = await settle<StoryMap | undefined>(store(db, 'readonly').get(id))
    return result === null ? memory.get(id) : result
  } catch {
    return memory.get(id)
  }
}

export async function putMap(map: StoryMap): Promise<void> {
  memory.set(map.id, map) // keep memory authoritative as a safety net
  const db = await getDb()
  if (!db) return
  try {
    await settle(store(db, 'readwrite').put(map))
  } catch {
    enterMemoryMode()
  }
}

export async function deleteMap(id: string): Promise<void> {
  memory.delete(id)
  const db = await getDb()
  if (!db) return
  try {
    await settle(store(db, 'readwrite').delete(id))
  } catch {
    enterMemoryMode()
  }
}
