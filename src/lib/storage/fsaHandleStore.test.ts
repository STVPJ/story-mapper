import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * fsaHandleStore wraps the IndexedDB boundary with the same "never hangs,
 * never rejects" discipline as the maps store. We inject a controllable
 * fake `indexedDB` (the boundary) and test OUR wrapper behaviour.
 */

/* ---- minimal in-memory fake IndexedDB ---- */

type FakeReq<T> = {
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  result?: T
}

function makeReq<T>(): FakeReq<T> {
  return { onsuccess: null, onerror: null, result: undefined }
}

function createFakeIndexedDB(opts: { hang?: boolean } = {}) {
  const stores = new Map<string, Map<unknown, unknown>>()
  const meta = new Map<string, { keyPath?: string }>()
  let version = 0

  function makeDb(): IDBDatabase {
    return {
      objectStoreNames: { contains: (n: string) => stores.has(n) },
      createObjectStore(name: string, o?: { keyPath?: string }) {
        stores.set(name, new Map())
        meta.set(name, { keyPath: o?.keyPath })
      },
      transaction(_names: string | string[], _mode?: string) {
        return {
          objectStore(name: string) {
            const data = stores.get(name)!
            const kp = meta.get(name)?.keyPath
            const fire = (req: FakeReq<unknown>, result?: unknown) => {
              setTimeout(() => {
                req.result = result
                req.onsuccess?.()
              }, 0)
            }
            return {
              count() {
                const req = makeReq<number>()
                fire(req, data.size)
                return req
              },
              get(key: unknown) {
                const req = makeReq<unknown>()
                fire(req, data.get(key))
                return req
              },
              getAll() {
                const req = makeReq<unknown[]>()
                fire(req, [...data.values()])
                return req
              },
              put(value: unknown, key?: unknown) {
                const k = kp ? (value as Record<string, unknown>)[kp] : key
                data.set(k, value)
                const req = makeReq<unknown>()
                fire(req, k)
                return req
              },
              delete(key: unknown) {
                data.delete(key)
                const req = makeReq<unknown>()
                fire(req, undefined)
                return req
              },
            }
          },
        }
      },
    } as unknown as IDBDatabase
  }

  type FakeOpenReq = {
    onupgradeneeded: (() => void) | null
    onsuccess: (() => void) | null
    onerror: (() => void) | null
    onblocked: (() => void) | null
    result: IDBDatabase | undefined
  }

  return {
    open(_name: string, v: number) {
      const req: FakeOpenReq = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        result: undefined,
      }
      if (opts.hang) return req // never fires any event
      setTimeout(() => {
        const db = makeDb()
        req.result = db
        if (v > version) {
          version = v
          req.onupgradeneeded?.()
        }
        req.onsuccess?.()
      }, 0)
      return req
    },
  }
}

async function freshStore() {
  vi.resetModules()
  return await import('./fsaHandleStore')
}

const fakeHandle = { name: 'maps-folder', kind: 'directory' } as unknown as FileSystemDirectoryHandle

describe('fsaHandleStore', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns null when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const s = await freshStore()
    await expect(s.loadDirectoryHandle()).resolves.toBeNull()
  })

  it('round-trips a directory handle (save -> load)', async () => {
    vi.stubGlobal('indexedDB', createFakeIndexedDB())
    const s = await freshStore()

    await s.saveDirectoryHandle(fakeHandle)
    await expect(s.loadDirectoryHandle()).resolves.toBe(fakeHandle)
  })

  it('clearDirectoryHandle removes the saved handle', async () => {
    vi.stubGlobal('indexedDB', createFakeIndexedDB())
    const s = await freshStore()

    await s.saveDirectoryHandle(fakeHandle)
    await s.clearDirectoryHandle()
    await expect(s.loadDirectoryHandle()).resolves.toBeNull()
  })

  it('never hangs: resolves null if IndexedDB never responds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('indexedDB', createFakeIndexedDB({ hang: true }))
    const s = await freshStore()

    const pending = s.loadDirectoryHandle()
    await vi.advanceTimersByTimeAsync(3100)
    await expect(pending).resolves.toBeNull()
  })

  it('does not enter maps memory-mode when the handle store is unavailable', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('indexedDB', createFakeIndexedDB({ hang: true }))
    vi.resetModules()
    const idb = await import('./IndexedDB')
    const s = await import('./fsaHandleStore')

    const pending = s.loadDirectoryHandle()
    await vi.advanceTimersByTimeAsync(3100)
    await pending

    expect(idb.isMemoryMode()).toBe(false)
  })
})
