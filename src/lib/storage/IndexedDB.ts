/**
 * Thin IndexedDB wrapper for StoryMapper local persistence.
 *
 * Stores one record per story map using the map's UUID as key.
 * Each record is the full StoryMap object (features, epics, stories,
 * releases included) so there is a single read on startup and a
 * single write per mutation -- no joins or relational queries needed.
 */

import type { StoryMap } from '../../types'

const DB_NAME = 'story-mapper'
const DB_VERSION = 1
const STORE_NAME = 'maps'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/* ---- public API ---- */

let dbInstance: IDBDatabase | null = null

async function getDb(): Promise<IDBDatabase> {
  if (!dbInstance) {
    dbInstance = await open()
  }
  return dbInstance
}

export async function getAllMaps(): Promise<StoryMap[]> {
  const db = await getDb()
  const maps = await wrap<StoryMap[]>(tx(db, 'readonly').getAll())
  return maps.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

export async function getMap(id: string): Promise<StoryMap | undefined> {
  const db = await getDb()
  return wrap<StoryMap | undefined>(tx(db, 'readonly').get(id))
}

export async function putMap(map: StoryMap): Promise<void> {
  const db = await getDb()
  await wrap(tx(db, 'readwrite').put(map))
}

export async function deleteMap(id: string): Promise<void> {
  const db = await getDb()
  await wrap(tx(db, 'readwrite').delete(id))
}
