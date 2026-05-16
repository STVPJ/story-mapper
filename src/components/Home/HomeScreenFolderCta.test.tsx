import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryMap } from '../../types'

const { useFolderStorageOptIn } = vi.hoisted(() => ({
  useFolderStorageOptIn: vi.fn(),
}))
vi.mock('../Storage/useFolderStorageOptIn', () => ({ useFolderStorageOptIn }))

import { HomeScreen } from './HomeScreen'
import { AuthProvider } from '../Auth/AuthProvider'
import { useStoryMapStore } from '../../store/useStoryMapStore'

function seed(adapterKind: 'idb' | 'fs') {
  const m: StoryMap = {
    id: 'm1', user_id: 'local', name: 'Map 1', features: [], releases: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
  useStoryMapStore.setState({
    storyMaps: [m],
    loading: false,
    adapter: { init: async () => [] } as never,
    adapterKind,
    needsReconnect: false,
    currentMapId: null,
  })
}

const renderHome = () =>
  render(
    <AuthProvider>
      <HomeScreen />
    </AuthProvider>
  )

describe('HomeScreen folder-storage CTA', () => {
  beforeEach(() => {
    useFolderStorageOptIn.mockReturnValue({
      supported: true,
      busy: false,
      enable: vi.fn(),
      conflict: null,
    })
  })
  afterEach(() => vi.clearAllMocks())

  it('shows "Use a folder" when supported and not already on disk', () => {
    seed('idb')
    renderHome()
    expect(
      screen.getAllByRole('button', { name: /use a folder/i }).length
    ).toBeGreaterThan(0)
  })

  it('hides the CTA when FSA is unsupported (Firefox/Safari)', () => {
    useFolderStorageOptIn.mockReturnValue({
      supported: false,
      busy: false,
      enable: vi.fn(),
      conflict: null,
    })
    seed('idb')
    renderHome()
    expect(screen.queryByRole('button', { name: /use a folder/i })).toBeNull()
  })

  it('hides the CTA when already using folder storage', () => {
    seed('fs')
    renderHome()
    expect(screen.queryByRole('button', { name: /use a folder/i })).toBeNull()
  })
})
