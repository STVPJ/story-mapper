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
