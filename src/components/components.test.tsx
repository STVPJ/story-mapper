import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock @dnd-kit
// ---------------------------------------------------------------------------
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
  horizontalListSortingStrategy: {},
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const result = [...arr]
    const [item] = result.splice(from, 1)
    result.splice(to, 0, item)
    return result
  },
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

// ---------------------------------------------------------------------------
// Mock Supabase (needed transitively by store)
// ---------------------------------------------------------------------------
const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } } }),
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              user: {
                id: 'test-user',
                email: 'test@test.com',
                user_metadata: { full_name: 'Test User', avatar_url: '' },
              },
            },
          },
        }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({}),
      signInWithOAuth: () => Promise.resolve({}),
    },
    from: () => ({
      select: () => ({
        order: () => ({
          then: (fn: (val: { data: unknown[]; error: null }) => void) =>
            fn({ data: [], error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  },
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { Button } from './shared/Button'
import { ColourPicker } from './shared/ColourPicker'
import { Toast } from './shared/Toast'
import { Input } from './shared/Input'
import { ConfirmDialog } from './shared/ConfirmDialog'
import { PromptDialog } from './shared/PromptDialog'
import { FeatureCard } from './Cards/FeatureCard'
import { EpicCard } from './Cards/EpicCard'
import { StoryCard } from './Cards/StoryCard'
import { useStoryMapStore } from '../store/useStoryMapStore'
import { RELEASE_COLOURS } from '../utils/colours'

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick handler', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Go</Button>)
    await userEvent.click(screen.getByText('Go'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders as disabled', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByText('Disabled').closest('button')).toBeDisabled()
  })

  it('applies primary variant styling', () => {
    render(<Button variant="primary">Primary</Button>)
    const btn = screen.getByText('Primary').closest('button')!
    expect(btn.className).toContain('bg-indigo-600')
  })

  it('applies danger variant styling', () => {
    render(<Button variant="danger">Danger</Button>)
    const btn = screen.getByText('Danger').closest('button')!
    expect(btn.className).toContain('bg-red-600')
  })

  it('applies ghost variant styling', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByText('Ghost').closest('button')!
    expect(btn.className).toContain('hover:bg-gray-700')
  })

  it('applies small size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByText('Small').closest('button')!
    expect(btn.className).toContain('py-1.5')
  })
})

// ---------------------------------------------------------------------------
// ColourPicker
// ---------------------------------------------------------------------------
describe('ColourPicker', () => {
  it('renders all release colour swatches', () => {
    const handleChange = vi.fn()
    render(<ColourPicker value="#6366F1" onChange={handleChange} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(RELEASE_COLOURS.length)
  })

  it('calls onChange with selected colour', async () => {
    const handleChange = vi.fn()
    render(<ColourPicker value="#6366F1" onChange={handleChange} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[2]) // third colour
    expect(handleChange).toHaveBeenCalledWith(RELEASE_COLOURS[2])
  })

  it('highlights currently selected colour', () => {
    render(<ColourPicker value="#8B5CF6" onChange={() => {}} />)
    const selected = screen.getByLabelText('Select colour #8B5CF6')
    expect(selected.className).toContain('ring-2')
  })
})

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
describe('Toast', () => {
  beforeEach(() => {
    useStoryMapStore.setState({ error: null })
  })

  it('renders nothing when no error', () => {
    const { container } = render(<Toast />)
    expect(container.firstChild).toBeNull()
  })

  it('renders error message when error exists', () => {
    useStoryMapStore.setState({ error: 'Something went wrong' })
    render(<Toast />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('has a close button', () => {
    useStoryMapStore.setState({ error: 'Error!' })
    render(<Toast />)
    const closeBtn = screen.getByRole('button')
    expect(closeBtn).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// FeatureCard
// ---------------------------------------------------------------------------
describe('FeatureCard', () => {
  const feature = {
    id: 'f-1',
    user_id: 'u',
    story_map_id: 'sm-1',
    title: 'User Authentication',
    description: 'Login flow',
    acceptance_criteria: 'Must support OAuth',
    order: 0,
    epics: [],
  }

  it('renders feature title', () => {
    render(<FeatureCard feature={feature} onClick={() => {}} />)
    expect(screen.getByText('User Authentication')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<FeatureCard feature={feature} onClick={handleClick} />)
    await userEvent.click(screen.getByText('User Authentication'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('has deep indigo background', () => {
    render(<FeatureCard feature={feature} onClick={() => {}} />)
    const card = screen.getByText('User Authentication').closest('div')!
    expect(card.className).toContain('bg-[#312E81]')
  })

  it('shows drop target highlight when isDropTarget is true', () => {
    render(<FeatureCard feature={feature} onClick={() => {}} isDropTarget />)
    const card = screen.getByText('User Authentication').closest('div')!
    expect(card.className).toContain('ring-2')
    expect(card.className).toContain('ring-indigo-400')
  })

  it('does not show drop target highlight by default', () => {
    render(<FeatureCard feature={feature} onClick={() => {}} />)
    const card = screen.getByText('User Authentication').closest('div')!
    expect(card.className).not.toContain('ring-indigo-400')
  })
})

// ---------------------------------------------------------------------------
// EpicCard
// ---------------------------------------------------------------------------
describe('EpicCard', () => {
  const epic = {
    id: 'e-1',
    user_id: 'u',
    feature_id: 'f-1',
    title: 'Login Epic',
    description: 'OAuth flow',
    acceptance_criteria: '',
    order: 0,
    stories: [],
  }

  it('renders epic title', () => {
    render(<EpicCard epic={epic} onClick={() => {}} />)
    expect(screen.getByText('Login Epic')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<EpicCard epic={epic} onClick={handleClick} />)
    await userEvent.click(screen.getByText('Login Epic'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('has teal background', () => {
    render(<EpicCard epic={epic} onClick={() => {}} />)
    const card = screen.getByText('Login Epic').closest('div')!
    expect(card.className).toContain('bg-[#0891B2]')
  })

  it('shows drop target highlight when isDropTarget is true', () => {
    render(<EpicCard epic={epic} onClick={() => {}} isDropTarget />)
    const card = screen.getByText('Login Epic').closest('div')!
    expect(card.className).toContain('ring-2')
    expect(card.className).toContain('ring-cyan-300')
  })

  it('does not show drop target highlight by default', () => {
    render(<EpicCard epic={epic} onClick={() => {}} />)
    const card = screen.getByText('Login Epic').closest('div')!
    expect(card.className).not.toContain('ring-cyan-300')
  })
})

// ---------------------------------------------------------------------------
// StoryCard
// ---------------------------------------------------------------------------
describe('StoryCard', () => {
  const releases = [
    { id: 'r-1', user_id: 'u', story_map_id: 'sm-1', name: 'Sprint 1', order: 0, colour: '#EF4444' },
  ]

  const story = {
    id: 's-1',
    user_id: 'u',
    epic_id: 'e-1',
    release_id: 'r-1',
    title: 'Add login button',
    description: 'Button on navbar',
    acceptance_criteria: '',
    order: 0,
  }

  it('renders story title', () => {
    render(<StoryCard story={story} releases={releases} onClick={() => {}} />)
    expect(screen.getByText('Add login button')).toBeInTheDocument()
  })

  it('renders story description', () => {
    render(<StoryCard story={story} releases={releases} onClick={() => {}} />)
    expect(screen.getByText('Button on navbar')).toBeInTheDocument()
  })

  it('does not render description when empty', () => {
    const noDesc = { ...story, description: '' }
    render(<StoryCard story={noDesc} releases={releases} onClick={() => {}} />)
    expect(screen.queryByText('Button on navbar')).not.toBeInTheDocument()
  })

  it('shows release colour accent', () => {
    const { container } = render(
      <StoryCard story={story} releases={releases} onClick={() => {}} />
    )
    const accent = container.querySelector('[style*="background-color"]') as HTMLElement
    expect(accent).toBeTruthy()
    expect(accent.style.backgroundColor).toContain('rgb(239, 68, 68)') // #EF4444
  })

  it('shows default accent when no release', () => {
    const noRelease = { ...story, release_id: null }
    const { container } = render(
      <StoryCard story={noRelease} releases={releases} onClick={() => {}} />
    )
    const accent = container.querySelector('[style*="background-color"]') as HTMLElement
    expect(accent).toBeTruthy()
    expect(accent.style.backgroundColor).toContain('rgb(75, 85, 99)') // #4B5563
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<StoryCard story={story} releases={releases} onClick={handleClick} />)
    await userEvent.click(screen.getByText('Add login button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('does not render label when omitted', () => {
    const { container } = render(<Input />)
    expect(container.querySelector('label')).toBeNull()
  })

  it('passes HTML attributes through', () => {
    render(<Input type="email" disabled data-testid="email-input" />)
    const input = screen.getByTestId('email-input')
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('type', 'email')
  })

  it('accepts user input', async () => {
    render(<Input data-testid="name-input" />)
    const input = screen.getByTestId('name-input')
    await userEvent.type(input, 'Hello')
    expect(input).toHaveValue('Hello')
  })
})

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(
      <ConfirmDialog
        title="Delete map?"
        message="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Delete map?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('uses default confirm label', () => {
    render(
      <ConfirmDialog
        title="Are you sure?"
        message="Proceed?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('uses custom confirm label', () => {
    render(
      <ConfirmDialog
        title="Delete"
        message="Sure?"
        confirmLabel="Delete forever"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Delete forever')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const handleConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="Delete"
        message="Sure?"
        confirmLabel="Yes"
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    await userEvent.click(screen.getByText('Yes'))
    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Delete"
        message="Sure?"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel on Escape key', async () => {
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Delete"
        message="Sure?"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    await userEvent.keyboard('{Escape}')
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm on Enter key', async () => {
    const handleConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="Remove item"
        message="Sure?"
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    await userEvent.keyboard('{Enter}')
    // Enter fires both the global keydown handler and the autoFocused button click
    expect(handleConfirm).toHaveBeenCalled()
  })

  it('applies danger variant when danger prop is true', () => {
    render(
      <ConfirmDialog
        title="Remove item"
        message="Sure?"
        confirmLabel="Delete permanently"
        danger
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    const btn = screen.getByText('Delete permanently').closest('button')!
    expect(btn.className).toContain('bg-red-600')
  })

  it('applies primary variant when danger is false', () => {
    render(
      <ConfirmDialog
        title="Confirm action"
        message="Save changes?"
        confirmLabel="Save now"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    const btn = screen.getByText('Save now').closest('button')!
    expect(btn.className).toContain('bg-indigo-600')
  })

  it('calls onCancel when backdrop clicked', async () => {
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Delete"
        message="Sure?"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    // Click the backdrop (the outer fixed div)
    const backdrop = screen.getByText('Delete').closest('.fixed')!
    await userEvent.click(backdrop)
    expect(handleCancel).toHaveBeenCalled()
  })

  it('does not call onCancel when dialog body clicked', async () => {
    const handleCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Delete"
        message="Sure?"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    // Click the inner dialog content (should stopPropagation)
    await userEvent.click(screen.getByText('Sure?'))
    expect(handleCancel).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// PromptDialog
// ---------------------------------------------------------------------------
describe('PromptDialog', () => {
  it('renders title', () => {
    render(
      <PromptDialog
        title="Rename map"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Rename map')).toBeInTheDocument()
  })

  it('uses default confirm label', () => {
    render(
      <PromptDialog
        title="Rename"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('uses custom confirm label', () => {
    render(
      <PromptDialog
        title="Edit name"
        confirmLabel="Rename"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Rename')).toBeInTheDocument()
  })

  it('populates input with default value', () => {
    render(
      <PromptDialog
        title="Rename"
        defaultValue="My Map"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    const input = screen.getByDisplayValue('My Map')
    expect(input).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', async () => {
    const handleCancel = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm with trimmed value on confirm click', async () => {
    const handleConfirm = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        defaultValue="Original"
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    const input = screen.getByDisplayValue('Original')
    await userEvent.clear(input)
    await userEvent.type(input, '  New Name  ')
    await userEvent.click(screen.getByText('Save'))
    expect(handleConfirm).toHaveBeenCalledWith('New Name')
  })

  it('does not call onConfirm when value is empty', async () => {
    const handleConfirm = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        defaultValue=""
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    await userEvent.click(screen.getByText('Save'))
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when value is only whitespace', async () => {
    const handleConfirm = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        defaultValue=""
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '   ')
    await userEvent.click(screen.getByText('Save'))
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm with trimmed value on Enter key', async () => {
    const handleConfirm = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        defaultValue="Test"
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    const input = screen.getByDisplayValue('Test')
    await userEvent.click(input)
    await userEvent.keyboard('{Enter}')
    expect(handleConfirm).toHaveBeenCalledWith('Test')
  })

  it('calls onCancel on Escape key in input', async () => {
    const handleCancel = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        defaultValue="Test"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    const input = screen.getByDisplayValue('Test')
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm on Enter when input is empty', async () => {
    const handleConfirm = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        defaultValue=""
        onConfirm={handleConfirm}
        onCancel={() => {}}
      />
    )
    const input = screen.getByRole('textbox')
    await userEvent.click(input)
    await userEvent.keyboard('{Enter}')
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when backdrop clicked', async () => {
    const handleCancel = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    const backdrop = screen.getByText('Rename').closest('.fixed')!
    await userEvent.click(backdrop)
    expect(handleCancel).toHaveBeenCalled()
  })

  it('does not call onCancel when dialog body clicked', async () => {
    const handleCancel = vi.fn()
    render(
      <PromptDialog
        title="Rename"
        onConfirm={() => {}}
        onCancel={handleCancel}
      />
    )
    await userEvent.click(screen.getByText('Rename'))
    expect(handleCancel).not.toHaveBeenCalled()
  })
})
