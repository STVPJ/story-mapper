import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fresh module graph per test so the banner and the IndexedDB module
// share the same (resettable) memory-mode state.
async function setup() {
  vi.resetModules()
  const idb = await import('../../lib/storage/IndexedDB')
  const { StorageWarningBanner } = await import('./StorageWarningBanner')
  return { idb, StorageWarningBanner }
}

describe('StorageWarningBanner', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('renders nothing while storage is healthy', async () => {
    const { StorageWarningBanner } = await setup()
    render(<StorageWarningBanner />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a warning when storage falls back to memory mode', async () => {
    const { idb, StorageWarningBanner } = await setup()
    render(<StorageWarningBanner />)

    act(() => {
      idb.enterMemoryMode()
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/won't be saved/i)
    expect(alert).toHaveTextContent(/export/i)
  })

  it('can be dismissed', async () => {
    const { idb, StorageWarningBanner } = await setup()
    render(<StorageWarningBanner />)
    act(() => {
      idb.enterMemoryMode()
    })

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
