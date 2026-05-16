import { describe, it, expect } from 'vitest'
import { importSchema } from './importSchema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validImport() {
  return {
    name: 'Test Map',
    features: [
      {
        title: 'Feature 1',
        description: 'Desc',
        acceptance_criteria: 'AC',
        order: 0,
        epics: [
          {
            title: 'Epic 1',
            description: '',
            acceptance_criteria: '',
            order: 0,
            stories: [
              {
                title: 'Story 1',
                description: '',
                acceptance_criteria: '',
                order: 0,
                release_id: 'r-1',
              },
            ],
          },
        ],
      },
    ],
    releases: [
      { id: 'r-1', name: 'Sprint 1', order: 0, colour: '#EF4444' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Valid imports
// ---------------------------------------------------------------------------
describe('importSchema – valid inputs', () => {
  it('accepts a complete valid import', () => {
    const result = importSchema.safeParse(validImport())
    expect(result.success).toBe(true)
  })

  it('accepts import with no releases (defaults to empty array)', () => {
    const { releases, ...noReleases } = validImport()
    const result = importSchema.safeParse(noReleases)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.releases).toEqual([])
    }
  })

  it('accepts import with no epics on a feature (defaults to empty array)', () => {
    const data = validImport()
    const { epics, ...featureNoEpics } = data.features[0]
    data.features = [featureNoEpics as typeof data.features[0]]
    data.releases = []
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.features[0].epics).toEqual([])
    }
  })

  it('accepts import with no stories on an epic (defaults to empty array)', () => {
    const data = validImport()
    const { stories, ...epicNoStories } = data.features[0].epics[0]
    data.features[0].epics = [epicNoStories as (typeof data.features[0])['epics'][number]]
    data.releases = []
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.features[0].epics[0].stories).toEqual([])
    }
  })

  it('defaults empty description and acceptance_criteria on features', () => {
    const data = {
      name: 'Minimal',
      features: [{ title: 'F1', order: 0 }],
    }
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.features[0].description).toBe('')
      expect(result.data.features[0].acceptance_criteria).toBe('')
    }
  })

  it('defaults empty description and acceptance_criteria on epics', () => {
    const data = {
      name: 'Minimal',
      features: [
        {
          title: 'F1',
          order: 0,
          epics: [{ title: 'E1', order: 0 }],
        },
      ],
    }
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.features[0].epics[0].description).toBe('')
      expect(result.data.features[0].epics[0].acceptance_criteria).toBe('')
    }
  })

  it('defaults empty description and acceptance_criteria on stories', () => {
    const data = {
      name: 'Minimal',
      features: [
        {
          title: 'F1',
          order: 0,
          epics: [{ title: 'E1', order: 0, stories: [{ title: 'S1', order: 0 }] }],
        },
      ],
    }
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      const story = result.data.features[0].epics[0].stories[0]
      expect(story.description).toBe('')
      expect(story.acceptance_criteria).toBe('')
    }
  })

  it('accepts story with null release_id', () => {
    const data = validImport()
    data.features[0].epics[0].stories[0].release_id = null
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts story without release_id (optional)', () => {
    const data = validImport()
    const { release_id, ...storyNoRelease } = data.features[0].epics[0].stories[0]
    data.features[0].epics[0].stories = [storyNoRelease as (typeof data.features[0])['epics'][number]['stories'][number]]
    data.releases = []
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Invalid imports – missing required fields
// ---------------------------------------------------------------------------
describe('importSchema – missing required fields', () => {
  it('rejects import without name', () => {
    const { name, ...noName } = validImport()
    const result = importSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it('rejects import without features', () => {
    const { features, ...noFeatures } = validImport()
    const result = importSchema.safeParse(noFeatures)
    expect(result.success).toBe(false)
  })

  it('rejects feature without title', () => {
    const data = validImport()
    const { title, ...noTitle } = data.features[0]
    data.features = [noTitle as typeof data.features[0]]
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects feature without order', () => {
    const data = validImport()
    const { order, ...noOrder } = data.features[0]
    data.features = [noOrder as typeof data.features[0]]
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects epic without title', () => {
    const data = validImport()
    const { title, ...noTitle } = data.features[0].epics[0]
    data.features[0].epics = [noTitle as (typeof data.features[0])['epics'][number]]
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects story without title', () => {
    const data = validImport()
    const { title, ...noTitle } = data.features[0].epics[0].stories[0]
    data.features[0].epics[0].stories = [noTitle as (typeof data.features[0])['epics'][number]['stories'][number]]
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects release without id', () => {
    const data = validImport()
    const { id, ...noId } = data.releases[0]
    data.releases = [noId as typeof data.releases[0]]
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects release without name', () => {
    const data = validImport()
    const { name, ...noName } = data.releases[0]
    data.releases = [noName as typeof data.releases[0]]
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Invalid imports – wrong types
// ---------------------------------------------------------------------------
describe('importSchema – wrong types', () => {
  it('rejects name as number', () => {
    const data = { ...validImport(), name: 42 }
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects feature title as object', () => {
    const data = validImport()
    ;(data.features[0] as Record<string, unknown>).title = { nested: 'object' }
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects feature order as string', () => {
    const data = validImport()
    ;(data.features[0] as Record<string, unknown>).order = 'zero'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects features as string', () => {
    const data = { ...validImport(), features: 'not an array' }
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Size limits
// ---------------------------------------------------------------------------
describe('importSchema – size limits', () => {
  it('rejects more than 100 features', () => {
    const data = validImport()
    data.features = Array.from({ length: 101 }, (_, i) => ({
      title: `Feature ${i}`,
      description: '',
      acceptance_criteria: '',
      order: i,
      epics: [],
    }))
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('accepts exactly 100 features', () => {
    const data = validImport()
    data.features = Array.from({ length: 100 }, (_, i) => ({
      title: `Feature ${i}`,
      description: '',
      acceptance_criteria: '',
      order: i,
      epics: [],
    }))
    data.releases = []
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects more than 50 epics per feature', () => {
    const data = validImport()
    data.features[0].epics = Array.from({ length: 51 }, (_, i) => ({
      title: `Epic ${i}`,
      description: '',
      acceptance_criteria: '',
      order: i,
      stories: [],
    }))
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects more than 200 stories per epic', () => {
    const data = validImport()
    data.features[0].epics[0].stories = Array.from({ length: 201 }, (_, i) => ({
      title: `Story ${i}`,
      description: '',
      acceptance_criteria: '',
      order: i,
      release_id: null,
    }))
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Release colour validation
// ---------------------------------------------------------------------------
describe('importSchema – release colour format', () => {
  it('accepts valid 6-digit hex colour', () => {
    const data = validImport()
    data.releases[0].colour = '#AABBCC'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts lowercase hex colour', () => {
    const data = validImport()
    data.releases[0].colour = '#aabbcc'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects 3-digit hex colour', () => {
    const data = validImport()
    data.releases[0].colour = '#ABC'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects colour without hash', () => {
    const data = validImport()
    data.releases[0].colour = 'FF0000'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects named colour string', () => {
    const data = validImport()
    data.releases[0].colour = 'red'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects rgb() colour format', () => {
    const data = validImport()
    data.releases[0].colour = 'rgb(255,0,0)'
    const result = importSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
