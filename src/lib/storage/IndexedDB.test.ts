import { beforeEach, describe, expect, it, vi } from 'vitest'

// Module-level memory-mode state persists for the life of the module, so
// each test gets a fresh copy via resetModules + dynamic import.
async function freshModule() {
  vi.resetModules()
  return await import('./IndexedDB')
}

describe('memory-mode observability', () => {
  beforeEach(() => {
    // enterMemoryMode logs a single warning; keep test output pristine.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('is not in memory mode initially', async () => {
    const idb = await freshModule()
    expect(idb.isMemoryMode()).toBe(false)
  })

  it('notifies subscribers and flips state when entering memory mode', async () => {
    const idb = await freshModule()
    const cb = vi.fn()
    idb.subscribeMemoryMode(cb)

    idb.enterMemoryMode()

    expect(cb).toHaveBeenCalledTimes(1)
    expect(idb.isMemoryMode()).toBe(true)
  })

  it('only notifies once even if memory mode is entered repeatedly', async () => {
    const idb = await freshModule()
    const cb = vi.fn()
    idb.subscribeMemoryMode(cb)

    idb.enterMemoryMode()
    idb.enterMemoryMode()

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', async () => {
    const idb = await freshModule()
    const cb = vi.fn()
    const unsubscribe = idb.subscribeMemoryMode(cb)

    unsubscribe()
    idb.enterMemoryMode()

    expect(cb).not.toHaveBeenCalled()
  })
})
