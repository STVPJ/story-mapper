import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExistingFilesDialog } from './ExistingFilesDialog'

describe('ExistingFilesDialog', () => {
  const base = {
    folderCount: 3,
    currentCount: 2,
    onMerge: vi.fn(),
    onUseFolder: vi.fn(),
    onCancel: vi.fn(),
  }

  it('shows the counts and three choices', () => {
    render(<ExistingFilesDialog {...base} />)
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /merge/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /use the folder/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('invokes the matching handler per choice', async () => {
    const onMerge = vi.fn()
    const onUseFolder = vi.fn()
    const onCancel = vi.fn()
    render(
      <ExistingFilesDialog
        {...base}
        onMerge={onMerge}
        onUseFolder={onUseFolder}
        onCancel={onCancel}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /merge/i }))
    await userEvent.click(screen.getByRole('button', { name: /use the folder/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onMerge).toHaveBeenCalledTimes(1)
    expect(onUseFolder).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
