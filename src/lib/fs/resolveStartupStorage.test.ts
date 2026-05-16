import { describe, expect, it, vi } from 'vitest'
import { resolveStartupStorage } from './resolveStartupStorage'

function handleWith(perm: PermissionState | (() => Promise<PermissionState>)) {
  return {
    queryPermission: vi.fn(
      typeof perm === 'function' ? perm : async () => perm
    ),
  } as unknown as FileSystemDirectoryHandle
}

const baseDeps = {
  isLocalMode: () => true,
  isFsaSupported: () => true,
  loadDirectoryHandle: async () => null as FileSystemDirectoryHandle | null,
}

describe('resolveStartupStorage', () => {
  it('uses supabase when not in local mode', async () => {
    const plan = await resolveStartupStorage({ ...baseDeps, isLocalMode: () => false })
    expect(plan).toEqual({ kind: 'supabase' })
  })

  it('uses idb when there is no saved handle', async () => {
    const plan = await resolveStartupStorage(baseDeps)
    expect(plan).toEqual({ kind: 'idb' })
  })

  it('uses idb when a handle exists but FSA is unsupported', async () => {
    const handle = handleWith('granted')
    const plan = await resolveStartupStorage({
      ...baseDeps,
      isFsaSupported: () => false,
      loadDirectoryHandle: async () => handle,
    })
    expect(plan).toEqual({ kind: 'idb' })
  })

  it('uses fs when permission is already granted', async () => {
    const handle = handleWith('granted')
    const plan = await resolveStartupStorage({
      ...baseDeps,
      loadDirectoryHandle: async () => handle,
    })
    expect(plan).toEqual({ kind: 'fs', handle })
  })

  it('asks to reconnect when permission is prompt', async () => {
    const handle = handleWith('prompt')
    const plan = await resolveStartupStorage({
      ...baseDeps,
      loadDirectoryHandle: async () => handle,
    })
    expect(plan).toEqual({ kind: 'reconnect', handle })
  })

  it('falls back to idb with a notice when permission is denied', async () => {
    const handle = handleWith('denied')
    const plan = await resolveStartupStorage({
      ...baseDeps,
      loadDirectoryHandle: async () => handle,
    })
    expect(plan.kind).toBe('idb')
    expect('notice' in plan && plan.notice).toMatch(/browser storage/i)
  })

  it('never throws if loadDirectoryHandle rejects', async () => {
    const plan = await resolveStartupStorage({
      ...baseDeps,
      loadDirectoryHandle: async () => {
        throw new Error('idb boom')
      },
    })
    expect(plan).toEqual({ kind: 'idb' })
  })

  it('falls back to idb if queryPermission rejects', async () => {
    const handle = handleWith(async () => {
      throw new Error('perm boom')
    })
    const plan = await resolveStartupStorage({
      ...baseDeps,
      loadDirectoryHandle: async () => handle,
    })
    expect(plan.kind).toBe('idb')
  })
})
