import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestFsaPermission, createFileSystemAdapter, createAdapter, clearDirectoryHandle } =
  vi.hoisted(() => ({
    requestFsaPermission: vi.fn(),
    createFileSystemAdapter: vi.fn(),
    createAdapter: vi.fn(),
    clearDirectoryHandle: vi.fn(async () => {}),
  }))

vi.mock('../../lib/fs/fsaPermissions', () => ({ requestFsaPermission }))
vi.mock('../../lib/adapters', () => ({ createFileSystemAdapter, createAdapter }))
vi.mock('../../lib/storage/fsaHandleStore', () => ({ clearDirectoryHandle }))

import { ReconnectFolderScreen } from './ReconnectFolderScreen'
import { useStoryMapStore } from '../../store/useStoryMapStore'

const handle = { name: 'maps' } as unknown as FileSystemDirectoryHandle

function fakeAdapter(tag: string) {
  return { tag, init: vi.fn(async () => []) } as unknown as Awaited<
    ReturnType<typeof createFileSystemAdapter>
  >
}

describe('ReconnectFolderScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStoryMapStore.setState({
      adapter: null,
      adapterKind: null,
      storyMaps: [],
      loading: false,
      error: null,
      needsReconnect: true,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('reconnects with the folder when permission is granted', async () => {
    requestFsaPermission.mockResolvedValue('granted')
    const fsAdapter = fakeAdapter('fs')
    createFileSystemAdapter.mockResolvedValue(fsAdapter)

    render(<ReconnectFolderScreen handle={handle} />)
    await userEvent.click(screen.getByRole('button', { name: /reconnect/i }))

    expect(requestFsaPermission).toHaveBeenCalledWith(handle)
    expect(createFileSystemAdapter).toHaveBeenCalledWith(handle)
    expect(useStoryMapStore.getState().adapter).toBe(fsAdapter)
    expect(useStoryMapStore.getState().adapterKind).toBe('fs')
    expect(useStoryMapStore.getState().needsReconnect).toBe(false)
  })

  it('falls back to browser storage and clears the handle on opt-out', async () => {
    const idbAdapter = fakeAdapter('idb')
    createAdapter.mockResolvedValue(idbAdapter)

    render(<ReconnectFolderScreen handle={handle} />)
    await userEvent.click(
      screen.getByRole('button', { name: /use browser storage/i })
    )

    expect(clearDirectoryHandle).toHaveBeenCalled()
    expect(createAdapter).toHaveBeenCalled()
    expect(useStoryMapStore.getState().adapter).toBe(idbAdapter)
    expect(useStoryMapStore.getState().needsReconnect).toBe(false)
  })

  it('keeps the screen up if permission is still denied', async () => {
    requestFsaPermission.mockResolvedValue('denied')

    render(<ReconnectFolderScreen handle={handle} />)
    await userEvent.click(screen.getByRole('button', { name: /reconnect/i }))

    expect(createFileSystemAdapter).not.toHaveBeenCalled()
    expect(useStoryMapStore.getState().needsReconnect).toBe(true)
  })
})
