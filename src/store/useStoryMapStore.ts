import { create } from 'zustand'
import type { StorageAdapter } from '../lib/adapters'
import type { LocalStorageAdapter } from '../lib/adapters/LocalStorageAdapter'
import type { StoryMap, Feature, Epic, Story, Release } from '../types'

/** Which storage backend is currently active. */
export type AdapterKind = 'idb' | 'fs' | 'supabase'

interface StoryMapStore {
  storyMaps: StoryMap[]
  currentMapId: string | null
  loading: boolean
  error: string | null
  adapter: StorageAdapter | null
  adapterKind: AdapterKind | null
  /** A saved FSA folder needs the user to re-grant access this session. */
  needsReconnect: boolean

  setError: (error: string | null) => void
  setCurrentMap: (id: string | null) => void
  getCurrentMap: () => StoryMap | undefined

  /** Initialise the store with a storage adapter. */
  initAdapter: (adapter: StorageAdapter, kind?: AdapterKind) => Promise<void>

  /**
   * Hot-swap the active adapter (FSA opt-in / reconnect). Synchronous and
   * deliberately never toggles `loading` -- the maps have already been
   * migrated by the caller, so flipping `loading` here would needlessly
   * unmount the current screen (the documented "stuck on Loading" loop).
   */
  swapAdapter: (adapter: StorageAdapter, maps: StoryMap[]) => void

  // Data fetching
  fetchStoryMaps: () => Promise<void>

  // Story Map CRUD
  createStoryMap: (name?: string) => Promise<string | null>
  updateStoryMapName: (id: string, name: string) => Promise<void>
  deleteStoryMap: (id: string) => Promise<void>
  duplicateStoryMap: (id: string) => Promise<string | null>

  // Feature CRUD
  addFeature: (storyMapId: string) => Promise<string | null>
  updateFeature: (id: string, data: Partial<Pick<Feature, 'title' | 'description' | 'acceptance_criteria'>>) => Promise<void>
  deleteFeature: (id: string) => Promise<void>
  reorderFeatures: (storyMapId: string, features: Feature[]) => void

  // Epic CRUD
  addEpic: (featureId: string) => Promise<string | null>
  updateEpic: (id: string, data: Partial<Pick<Epic, 'title' | 'description' | 'acceptance_criteria'>>) => Promise<void>
  deleteEpic: (id: string) => Promise<void>
  reorderEpics: (featureId: string, epics: Epic[]) => void
  moveEpic: (epicId: string, targetFeatureId: string, newOrder: number) => void

  // Story CRUD
  addStory: (epicId: string, releaseId?: string | null) => Promise<string | null>
  updateStory: (id: string, data: Partial<Pick<Story, 'title' | 'description' | 'acceptance_criteria' | 'release_id'>>) => Promise<void>
  deleteStory: (id: string) => Promise<void>
  reorderStories: (epicId: string, stories: Story[]) => void
  moveStory: (storyId: string, targetEpicId: string, releaseId: string | null, newOrder: number) => void

  // Release CRUD
  addRelease: (storyMapId: string) => Promise<string | null>
  updateRelease: (id: string, data: Partial<Pick<Release, 'name' | 'colour'>>) => Promise<void>
  deleteRelease: (id: string) => Promise<void>
  reorderReleases: (storyMapId: string, releases: Release[]) => void

  // Promotion
  promoteStoryToEpic: (storyId: string, targetFeatureId: string, newOrder: number) => Promise<void>
}

function uuid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const LOCAL_USER_ID = 'local'

export const useStoryMapStore = create<StoryMapStore>((set, get) => ({
  storyMaps: [],
  currentMapId: null,
  loading: false,
  error: null,
  adapter: null,
  adapterKind: null,
  needsReconnect: false,

  setError: (error) => set({ error }),
  setCurrentMap: (id) => set({ currentMapId: id }),
  getCurrentMap: () => {
    const { storyMaps, currentMapId } = get()
    return storyMaps.find((m) => m.id === currentMapId)
  },

  initAdapter: async (adapter, kind = 'idb') => {
    // Idempotent: once an adapter is installed, ignore further calls.
    // Without this, a re-entrant caller can loop (set adapter -> render
    // -> effect -> createAdapter -> initAdapter -> ...).
    if (get().adapter) return
    set({ adapter, adapterKind: kind, loading: true, error: null })
    // If the adapter is local, wire up the maps reference
    if ('_setMapsRef' in adapter) {
      (adapter as LocalStorageAdapter)._setMapsRef(() => get().storyMaps)
    }
    try {
      const maps = await adapter.init()
      set({ storyMaps: maps, loading: false })
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  swapAdapter: (adapter, maps) => {
    if ('_setMapsRef' in adapter) {
      (adapter as LocalStorageAdapter)._setMapsRef(() => get().storyMaps)
    }
    // Single synchronous set, NO loading toggle: the caller has already
    // migrated `maps` to the new backend, currentMapId is preserved, and
    // the screen stays mounted.
    set({ adapter, adapterKind: 'fs', storyMaps: maps, error: null })
  },

  fetchStoryMaps: async () => {
    const { adapter } = get()
    if (!adapter) return
    set({ loading: true, error: null })
    try {
      const maps = await adapter.init()
      set({ storyMaps: maps, loading: false })
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  createStoryMap: async (name = 'Untitled Map') => {
    const { adapter } = get()
    if (!adapter) return null

    const id = uuid()
    const ts = now()
    const newMap: StoryMap = {
      id,
      user_id: LOCAL_USER_ID,
      name,
      created_at: ts,
      updated_at: ts,
      features: [],
      releases: [],
    }

    set((s) => ({ storyMaps: [newMap, ...s.storyMaps] }))

    try {
      await adapter.createMap(newMap)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
      return null
    }

    return id
  },

  updateStoryMapName: async (id, name) => {
    const { adapter } = get()
    if (!adapter) return

    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === id ? { ...m, name, updated_at: now() } : m
      ),
    }))

    try {
      await adapter.updateMap(id, { name })
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
    }
  },

  deleteStoryMap: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const prev = get().storyMaps

    set((s) => ({
      storyMaps: s.storyMaps.filter((m) => m.id !== id),
      currentMapId: s.currentMapId === id ? null : s.currentMapId,
    }))

    try {
      await adapter.deleteMap(id)
    } catch (err) {
      set({ error: getErrorMessage(err), storyMaps: prev })
    }
  },

  duplicateStoryMap: async (id) => {
    const { adapter } = get()
    if (!adapter) return null

    const map = get().storyMaps.find((m) => m.id === id)
    if (!map) return null

    // Deep-clone with new IDs
    const newMapId = uuid()
    const ts = now()
    const releaseIdMap = new Map<string, string>()

    const newReleases: Release[] = map.releases.map((r) => {
      const newId = uuid()
      releaseIdMap.set(r.id, newId)
      return { ...r, id: newId, story_map_id: newMapId, user_id: LOCAL_USER_ID }
    })

    const newFeatures: Feature[] = map.features.map((f) => ({
      ...f,
      id: uuid(),
      story_map_id: newMapId,
      user_id: LOCAL_USER_ID,
      epics: f.epics.map((e) => ({
        ...e,
        id: uuid(),
        user_id: LOCAL_USER_ID,
        stories: e.stories.map((s) => ({
          ...s,
          id: uuid(),
          user_id: LOCAL_USER_ID,
          release_id: s.release_id ? releaseIdMap.get(s.release_id) || null : null,
        })),
      })),
    }))

    // Fix up feature_id and epic_id references
    newFeatures.forEach((f) => {
      f.epics.forEach((e) => {
        e.feature_id = f.id
        e.stories.forEach((s) => {
          s.epic_id = e.id
        })
      })
    })

    const newMap: StoryMap = {
      id: newMapId,
      user_id: LOCAL_USER_ID,
      name: `${map.name} (copy)`,
      created_at: ts,
      updated_at: ts,
      features: newFeatures,
      releases: newReleases,
    }

    set((s) => ({ storyMaps: [newMap, ...s.storyMaps] }))

    try {
      await adapter.createMap(newMap)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
      return null
    }

    return newMapId
  },

  // Feature CRUD
  addFeature: async (storyMapId) => {
    const { adapter } = get()
    if (!adapter) return null

    const map = get().storyMaps.find((m) => m.id === storyMapId)
    const order = map ? map.features.length : 0
    const id = uuid()

    const newFeature: Feature = {
      id,
      user_id: LOCAL_USER_ID,
      story_map_id: storyMapId,
      title: 'New Feature',
      description: '',
      acceptance_criteria: '',
      order,
      epics: [],
    }

    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, features: [...m.features, newFeature], updated_at: now() } : m
      ),
    }))

    try {
      await adapter.createFeature(newFeature)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
      return null
    }

    return id
  },

  updateFeature: async (id, data) => {
    const { adapter } = get()
    if (!adapter) return

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => (f.id === id ? { ...f, ...data } : f)),
      })),
    }))

    try {
      await adapter.updateFeature(id, data)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
    }
  },

  deleteFeature: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const prev = get().storyMaps

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.filter((f) => f.id !== id),
      })),
    }))

    try {
      await adapter.deleteFeature(id)
    } catch (err) {
      set({ error: getErrorMessage(err), storyMaps: prev })
    }
  },

  reorderFeatures: (storyMapId, features) => {
    const { adapter } = get()
    if (!adapter) return

    const ordered = features.map((f, i) => ({ ...f, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, features: ordered } : m
      ),
    }))
    adapter.reorderFeatures(ordered.map((f) => ({ id: f.id, order: f.order })))
  },

  // Epic CRUD
  addEpic: async (featureId) => {
    const { adapter } = get()
    if (!adapter) return null

    let epicCount = 0
    for (const map of get().storyMaps) {
      const feature = map.features.find((f) => f.id === featureId)
      if (feature) {
        epicCount = feature.epics.length
        break
      }
    }

    const id = uuid()
    const newEpic: Epic = {
      id,
      user_id: LOCAL_USER_ID,
      feature_id: featureId,
      title: 'New Epic',
      description: '',
      acceptance_criteria: '',
      order: epicCount,
      stories: [],
    }

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) =>
          f.id === featureId ? { ...f, epics: [...f.epics, newEpic] } : f
        ),
      })),
    }))

    try {
      await adapter.createEpic(newEpic)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
      return null
    }

    return id
  },

  updateEpic: async (id, data) => {
    const { adapter } = get()
    if (!adapter) return

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      })),
    }))

    try {
      await adapter.updateEpic(id, data)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
    }
  },

  deleteEpic: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const prev = get().storyMaps

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.filter((e) => e.id !== id),
        })),
      })),
    }))

    try {
      await adapter.deleteEpic(id)
    } catch (err) {
      set({ error: getErrorMessage(err), storyMaps: prev })
    }
  },

  reorderEpics: (featureId, epics) => {
    const { adapter } = get()
    if (!adapter) return

    const ordered = epics.map((e, i) => ({ ...e, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) =>
          f.id === featureId ? { ...f, epics: ordered } : f
        ),
      })),
    }))
    adapter.reorderEpics(ordered.map((e) => ({ id: e.id, order: e.order })))
  },

  moveEpic: (epicId, targetFeatureId, newOrder) => {
    const { adapter } = get()
    if (!adapter) return

    let movedEpic: Epic | undefined
    const prev = get().storyMaps

    const updated = prev.map((m) => ({
      ...m,
      features: m.features.map((f) => {
        const epic = f.epics.find((e) => e.id === epicId)
        if (epic) {
          movedEpic = { ...epic, feature_id: targetFeatureId, order: newOrder }
          return { ...f, epics: f.epics.filter((e) => e.id !== epicId) }
        }
        return f
      }),
    }))

    if (!movedEpic) return

    const finalMaps = updated.map((m) => ({
      ...m,
      features: m.features.map((f) => {
        if (f.id === targetFeatureId) {
          const epics = [...f.epics]
          epics.splice(newOrder, 0, movedEpic!)
          return { ...f, epics: epics.map((e, i) => ({ ...e, order: i })) }
        }
        return f
      }),
    }))

    set({ storyMaps: finalMaps })

    adapter.moveEpic(epicId, targetFeatureId, newOrder).catch((err: unknown) => {
      set({ error: getErrorMessage(err), storyMaps: prev })
    })

    const targetFeature = finalMaps
      .flatMap((m) => m.features)
      .find((f) => f.id === targetFeatureId)
    if (targetFeature) {
      adapter.reorderEpics(targetFeature.epics.map((e) => ({ id: e.id, order: e.order })))
    }
  },

  // Story CRUD
  addStory: async (epicId, releaseId = null) => {
    const { adapter } = get()
    if (!adapter) return null

    let storyCount = 0
    for (const map of get().storyMaps) {
      for (const feature of map.features) {
        const epic = feature.epics.find((e) => e.id === epicId)
        if (epic) {
          storyCount = epic.stories.length
          break
        }
      }
    }

    const id = uuid()
    const newStory: Story = {
      id,
      user_id: LOCAL_USER_ID,
      epic_id: epicId,
      release_id: releaseId ?? null,
      title: 'New Story',
      description: '',
      acceptance_criteria: '',
      order: storyCount,
    }

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) =>
            e.id === epicId ? { ...e, stories: [...e.stories, newStory] } : e
          ),
        })),
      })),
    }))

    try {
      await adapter.createStory(newStory)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
      return null
    }

    return id
  },

  updateStory: async (id, data) => {
    const { adapter } = get()
    if (!adapter) return

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) => ({
            ...e,
            stories: e.stories.map((st) => (st.id === id ? { ...st, ...data } : st)),
          })),
        })),
      })),
    }))

    try {
      await adapter.updateStory(id, data)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
    }
  },

  deleteStory: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const prev = get().storyMaps

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) => ({
            ...e,
            stories: e.stories.filter((st) => st.id !== id),
          })),
        })),
      })),
    }))

    try {
      await adapter.deleteStory(id)
    } catch (err) {
      set({ error: getErrorMessage(err), storyMaps: prev })
    }
  },

  reorderStories: (epicId, stories) => {
    const { adapter } = get()
    if (!adapter) return

    const ordered = stories.map((st, i) => ({ ...st, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) =>
            e.id === epicId ? { ...e, stories: ordered } : e
          ),
        })),
      })),
    }))
    adapter.reorderStories(ordered.map((st) => ({ id: st.id, order: st.order })))
  },

  moveStory: (storyId, targetEpicId, releaseId, newOrder) => {
    const { adapter } = get()
    if (!adapter) return

    let movedStory: Story | undefined
    const prev = get().storyMaps

    const updated = prev.map((m) => ({
      ...m,
      features: m.features.map((f) => ({
        ...f,
        epics: f.epics.map((e) => {
          const story = e.stories.find((st) => st.id === storyId)
          if (story) {
            movedStory = { ...story, epic_id: targetEpicId, release_id: releaseId, order: newOrder }
            return { ...e, stories: e.stories.filter((st) => st.id !== storyId) }
          }
          return e
        }),
      })),
    }))

    if (!movedStory) return

    const finalMaps = updated.map((m) => ({
      ...m,
      features: m.features.map((f) => ({
        ...f,
        epics: f.epics.map((e) => {
          if (e.id === targetEpicId) {
            const stories = [...e.stories]
            stories.splice(newOrder, 0, movedStory!)
            return { ...e, stories: stories.map((st, i) => ({ ...st, order: i })) }
          }
          return e
        }),
      })),
    }))

    set({ storyMaps: finalMaps })

    adapter.moveStory(storyId, targetEpicId, releaseId, newOrder).catch((err: unknown) => {
      set({ error: getErrorMessage(err), storyMaps: prev })
    })

    const targetEpic = finalMaps
      .flatMap((m) => m.features)
      .flatMap((f) => f.epics)
      .find((e) => e.id === targetEpicId)
    if (targetEpic) {
      adapter.reorderStories(targetEpic.stories.map((st) => ({ id: st.id, order: st.order })))
    }
  },

  // Release CRUD
  addRelease: async (storyMapId) => {
    const { adapter } = get()
    if (!adapter) return null

    const map = get().storyMaps.find((m) => m.id === storyMapId)
    const order = map ? map.releases.length : 0
    const colours = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6']
    const colour = colours[order % colours.length]

    const id = uuid()
    const newRelease: Release = {
      id,
      user_id: LOCAL_USER_ID,
      story_map_id: storyMapId,
      name: 'New Release',
      order,
      colour,
    }

    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, releases: [...m.releases, newRelease] } : m
      ),
    }))

    try {
      await adapter.createRelease(newRelease)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
      return null
    }

    return id
  },

  updateRelease: async (id, data) => {
    const { adapter } = get()
    if (!adapter) return

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        releases: m.releases.map((r) => (r.id === id ? { ...r, ...data } : r)),
      })),
    }))

    try {
      await adapter.updateRelease(id, data)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      await get().fetchStoryMaps()
    }
  },

  deleteRelease: async (id) => {
    const { adapter } = get()
    if (!adapter) return
    const prev = get().storyMaps

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        releases: m.releases.filter((r) => r.id !== id),
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) => ({
            ...e,
            stories: e.stories.map((st) =>
              st.release_id === id ? { ...st, release_id: null } : st
            ),
          })),
        })),
      })),
    }))

    try {
      await adapter.deleteRelease(id)
    } catch (err) {
      set({ error: getErrorMessage(err), storyMaps: prev })
    }
  },

  reorderReleases: (storyMapId, releases) => {
    const { adapter } = get()
    if (!adapter) return

    const ordered = releases.map((r, i) => ({ ...r, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, releases: ordered } : m
      ),
    }))
    adapter.reorderReleases(ordered.map((r) => ({ id: r.id, order: r.order })))
  },

  // Promotion
  promoteStoryToEpic: async (storyId, targetFeatureId, newOrder) => {
    const { adapter } = get()
    if (!adapter) return

    let story: Story | undefined
    const prev = get().storyMaps

    for (const map of prev) {
      for (const feature of map.features) {
        for (const epic of feature.epics) {
          const found = epic.stories.find((st) => st.id === storyId)
          if (found) {
            story = found
            break
          }
        }
      }
    }

    if (!story) return

    // Remove story
    const updated = prev.map((m) => ({
      ...m,
      features: m.features.map((f) => ({
        ...f,
        epics: f.epics.map((e) => ({
          ...e,
          stories: e.stories.filter((st) => st.id !== storyId),
        })),
      })),
    }))

    // Create new epic from story data
    const epicId = crypto.randomUUID()
    const newEpic: Epic = {
      id: epicId,
      user_id: LOCAL_USER_ID,
      feature_id: targetFeatureId,
      title: story.title,
      description: story.description,
      acceptance_criteria: story.acceptance_criteria,
      order: newOrder,
      stories: [],
    }

    const finalMaps = updated.map((m) => ({
      ...m,
      features: m.features.map((f) => {
        if (f.id === targetFeatureId) {
          const epics = [...f.epics]
          epics.splice(newOrder, 0, newEpic)
          return { ...f, epics: epics.map((e, i) => ({ ...e, order: i })) }
        }
        return f
      }),
    }))

    set({ storyMaps: finalMaps })

    try {
      await adapter.promoteStoryToEpic(storyId, newEpic)
    } catch (err) {
      set({ error: getErrorMessage(err), storyMaps: prev })
    }
  },
}))
