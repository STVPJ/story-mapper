import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryMap } from '../../types'

const { isFsaSupported, createFileSystemAdapter, saveDirectoryHandle } =
  vi.hoisted(() => ({
    isFsaSupported: vi.fn(() => true),
    createFileSystemAdapter: vi.fn(),
    saveDirectoryHandle: vi.fn(async () => {}),
  }))

vi.mock('../../lib/fs/fsaSupport', () => ({ isFsaSupported }))
vi.mock('../../lib/adapters', () => ({ createFileSystemAdapter }))
vi.mock('../../lib/storage/fsaHandleStore', () => ({ saveDirectoryHandle }))

import { useFolderStorageOptIn } from './useFolderStorageOptIn'
import { useStoryMapStore } from '../../store/useStoryMapStore'

function map(id: string, name = id): StoryMap {
  return {
    id, user_id: 'local', name, features: [], releases: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

const dir = { name: 'picked' } as unknown as FileSystemDirectoryHandle

function fakeAdapter(folderMaps: StoryMap[]) {
  return {
    init: vi.fn(async () => folderMaps),
    createMap: vi.fn(async () => {}),
  }
}

describe('useFolderStorageOptIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isFsaSupported.mockReturnValue(true)
    useStoryMapStore.setState({
      storyMaps: [map('c1', 'Current')],
      adapter: null,
      adapterKind: 'idb',
      needsReconnect: false,
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker
  })

  it('reports support from isFsaSupported', () => {
    isFsaSupported.mockReturnValue(false)
    const { result } = renderHook(() => useFolderStorageOptIn())
    expect(result.current.supported).toBe(false)
  })

  it('migrates current maps into an empty folder and swaps adapter', async () => {
    const adapter = fakeAdapter([])
    createFileSystemAdapter.mockResolvedValue(adapter)
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker =
      vi.fn(async () => dir)

    const { result } = renderHook(() => useFolderStorageOptIn())
    await act(async () => {
      await result.current.enable()
    })

    expect(adapter.createMap).toHaveBeenCalledTimes(1) // the one current map
    expect(saveDirectoryHandle).toHaveBeenCalledWith(dir)
    expect(useStoryMapStore.getState().adapter).toBe(adapter)
    expect(useStoryMapStore.getState().adapterKind).toBe('fs')
  })

  it('is a no-op when the user cancels the picker', async () => {
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker =
      vi.fn(async () => {
        throw new DOMException('cancelled', 'AbortError')
      })

    const { result } = renderHook(() => useFolderStorageOptIn())
    await act(async () => {
      await result.current.enable()
    })

    expect(saveDirectoryHandle).not.toHaveBeenCalled()
    expect(useStoryMapStore.getState().adapter).toBeNull()
    expect(result.current.busy).toBe(false)
  })

  it('asks how to resolve when the folder already has maps; merge keeps both (current wins)', async () => {
    const folderMap = map('f1', 'Folder One')
    const collide = map('c1', 'Folder Version Of c1')
    const adapter = fakeAdapter([folderMap, collide])
    createFileSystemAdapter.mockResolvedValue(adapter)
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker =
      vi.fn(async () => dir)

    const { result } = renderHook(() => useFolderStorageOptIn())
    let enablePromise: Promise<void>
    await act(async () => {
      enablePromise = result.current.enable()
    })

    await waitFor(() => expect(result.current.conflict).not.toBeNull())
    await act(async () => {
      result.current.conflict!.resolve('merge')
      await enablePromise
    })

    const swapped = useStoryMapStore.getState().storyMaps
    expect(swapped.map((m) => m.id).sort()).toEqual(['c1', 'f1'])
    // current wins on the id clash
    expect(swapped.find((m) => m.id === 'c1')!.name).toBe('Current')
  })

  it('"use folder" replaces with the folder maps and writes nothing', async () => {
    const adapter = fakeAdapter([map('f1', 'Folder One')])
    createFileSystemAdapter.mockResolvedValue(adapter)
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker =
      vi.fn(async () => dir)

    const { result } = renderHook(() => useFolderStorageOptIn())
    let p: Promise<void>
    await act(async () => {
      p = result.current.enable()
    })
    await waitFor(() => expect(result.current.conflict).not.toBeNull())
    await act(async () => {
      result.current.conflict!.resolve('folder')
      await p
    })

    expect(adapter.createMap).not.toHaveBeenCalled()
    expect(useStoryMapStore.getState().storyMaps.map((m) => m.id)).toEqual(['f1'])
  })

  it('cancel in the conflict dialog aborts without swapping', async () => {
    const adapter = fakeAdapter([map('f1')])
    createFileSystemAdapter.mockResolvedValue(adapter)
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker =
      vi.fn(async () => dir)

    const { result } = renderHook(() => useFolderStorageOptIn())
    let p: Promise<void>
    await act(async () => {
      p = result.current.enable()
    })
    await waitFor(() => expect(result.current.conflict).not.toBeNull())
    await act(async () => {
      result.current.conflict!.resolve('cancel')
      await p
    })

    expect(useStoryMapStore.getState().adapter).toBeNull()
    expect(saveDirectoryHandle).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })
})
