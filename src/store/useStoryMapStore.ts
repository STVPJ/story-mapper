import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { StoryMap, Feature, Epic, Story, Release } from '../types'

let reorderTimeout: ReturnType<typeof setTimeout> | null = null

interface StoryMapStore {
  storyMaps: StoryMap[]
  currentMapId: string | null
  loading: boolean
  error: string | null

  setError: (error: string | null) => void
  setCurrentMap: (id: string | null) => void
  getCurrentMap: () => StoryMap | undefined

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

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

function debouncedReorder(table: string, items: { id: string; order: number }[]) {
  if (reorderTimeout) clearTimeout(reorderTimeout)
  reorderTimeout = setTimeout(async () => {
    const promises = items.map((item) =>
      supabase.from(table).update({ order: item.order }).eq('id', item.id)
    )
    const results = await Promise.all(promises)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error(`Reorder sync failed for ${table}:`, failed.error)
    }
  }, 300)
}

export const useStoryMapStore = create<StoryMapStore>((set, get) => ({
  storyMaps: [],
  currentMapId: null,
  loading: false,
  error: null,

  setError: (error) => set({ error }),
  setCurrentMap: (id) => set({ currentMapId: id }),
  getCurrentMap: () => {
    const { storyMaps, currentMapId } = get()
    return storyMaps.find((m) => m.id === currentMapId)
  },

  fetchStoryMaps: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('story_maps')
      .select('*, features(*, epics(*, stories(*))), releases(*)')
      .order('updated_at', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
      return
    }

    const maps: StoryMap[] = (data || []).map((m: any) => ({
      ...m,
      features: (m.features || [])
        .sort((a: Feature, b: Feature) => a.order - b.order)
        .map((f: any) => ({
          ...f,
          epics: (f.epics || [])
            .sort((a: Epic, b: Epic) => a.order - b.order)
            .map((e: any) => ({
              ...e,
              stories: (e.stories || []).sort((a: Story, b: Story) => a.order - b.order),
            })),
        })),
      releases: (m.releases || []).sort((a: Release, b: Release) => a.order - b.order),
    }))

    set({ storyMaps: maps, loading: false })
  },

  createStoryMap: async (name = 'Untitled Map') => {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('story_maps')
      .insert({ name, user_id: userId })
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return null
    }

    const newMap: StoryMap = { ...data, features: [], releases: [] }
    set((s) => ({ storyMaps: [newMap, ...s.storyMaps] }))
    return data.id
  },

  updateStoryMapName: async (id, name) => {
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => (m.id === id ? { ...m, name } : m)),
    }))

    const { error } = await supabase.from('story_maps').update({ name }).eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchStoryMaps()
    }
  },

  deleteStoryMap: async (id) => {
    const prev = get().storyMaps
    set((s) => ({
      storyMaps: s.storyMaps.filter((m) => m.id !== id),
      currentMapId: s.currentMapId === id ? null : s.currentMapId,
    }))

    const { error } = await supabase.from('story_maps').delete().eq('id', id)
    if (error) {
      set({ error: error.message, storyMaps: prev })
    }
  },

  duplicateStoryMap: async (id) => {
    const map = get().storyMaps.find((m) => m.id === id)
    if (!map) return null

    const userId = await getUserId()

    // Create new map
    const { data: newMapData, error: mapError } = await supabase
      .from('story_maps')
      .insert({ name: `${map.name} (copy)`, user_id: userId })
      .select()
      .single()
    if (mapError || !newMapData) {
      set({ error: mapError?.message || 'Failed to duplicate' })
      return null
    }

    // Duplicate releases
    const releaseIdMap = new Map<string, string>()
    for (const release of map.releases) {
      const { data: newRelease } = await supabase
        .from('releases')
        .insert({
          story_map_id: newMapData.id,
          user_id: userId,
          name: release.name,
          order: release.order,
          colour: release.colour,
        })
        .select()
        .single()
      if (newRelease) releaseIdMap.set(release.id, newRelease.id)
    }

    // Duplicate features, epics, stories
    for (const feature of map.features) {
      const { data: newFeature } = await supabase
        .from('features')
        .insert({
          story_map_id: newMapData.id,
          user_id: userId,
          title: feature.title,
          description: feature.description,
          acceptance_criteria: feature.acceptance_criteria,
          order: feature.order,
        })
        .select()
        .single()
      if (!newFeature) continue

      for (const epic of feature.epics) {
        const { data: newEpic } = await supabase
          .from('epics')
          .insert({
            feature_id: newFeature.id,
            user_id: userId,
            title: epic.title,
            description: epic.description,
            acceptance_criteria: epic.acceptance_criteria,
            order: epic.order,
          })
          .select()
          .single()
        if (!newEpic) continue

        for (const story of epic.stories) {
          await supabase.from('stories').insert({
            epic_id: newEpic.id,
            user_id: userId,
            release_id: story.release_id ? releaseIdMap.get(story.release_id) || null : null,
            title: story.title,
            description: story.description,
            acceptance_criteria: story.acceptance_criteria,
            order: story.order,
          })
        }
      }
    }

    await get().fetchStoryMaps()
    return newMapData.id
  },

  // Feature CRUD
  addFeature: async (storyMapId) => {
    const userId = await getUserId()
    const map = get().storyMaps.find((m) => m.id === storyMapId)
    const order = map ? map.features.length : 0

    const { data, error } = await supabase
      .from('features')
      .insert({ story_map_id: storyMapId, user_id: userId, order })
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return null
    }

    const newFeature: Feature = { ...data, epics: [] }
    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, features: [...m.features, newFeature] } : m
      ),
    }))
    return data.id
  },

  updateFeature: async (id, data) => {
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => (f.id === id ? { ...f, ...data } : f)),
      })),
    }))

    const { error } = await supabase.from('features').update(data).eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchStoryMaps()
    }
  },

  deleteFeature: async (id) => {
    const prev = get().storyMaps
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.filter((f) => f.id !== id),
      })),
    }))

    const { error } = await supabase.from('features').delete().eq('id', id)
    if (error) {
      set({ error: error.message, storyMaps: prev })
    }
  },

  reorderFeatures: (storyMapId, features) => {
    const ordered = features.map((f, i) => ({ ...f, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, features: ordered } : m
      ),
    }))
    debouncedReorder('features', ordered.map((f) => ({ id: f.id, order: f.order })))
  },

  // Epic CRUD
  addEpic: async (featureId) => {
    const userId = await getUserId()
    let epicCount = 0
    for (const map of get().storyMaps) {
      const feature = map.features.find((f) => f.id === featureId)
      if (feature) {
        epicCount = feature.epics.length
        break
      }
    }

    const { data, error } = await supabase
      .from('epics')
      .insert({ feature_id: featureId, user_id: userId, order: epicCount })
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return null
    }

    const newEpic: Epic = { ...data, stories: [] }
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) =>
          f.id === featureId ? { ...f, epics: [...f.epics, newEpic] } : f
        ),
      })),
    }))
    return data.id
  },

  updateEpic: async (id, data) => {
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      })),
    }))

    const { error } = await supabase.from('epics').update(data).eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchStoryMaps()
    }
  },

  deleteEpic: async (id) => {
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

    const { error } = await supabase.from('epics').delete().eq('id', id)
    if (error) {
      set({ error: error.message, storyMaps: prev })
    }
  },

  reorderEpics: (featureId, epics) => {
    const ordered = epics.map((e, i) => ({ ...e, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) =>
          f.id === featureId ? { ...f, epics: ordered } : f
        ),
      })),
    }))
    debouncedReorder('epics', ordered.map((e) => ({ id: e.id, order: e.order })))
  },

  moveEpic: (epicId, targetFeatureId, newOrder) => {
    let movedEpic: Epic | undefined
    const prev = get().storyMaps

    // Find and remove epic from source
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

    // Add to target feature
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

    // Sync to Supabase
    supabase
      .from('epics')
      .update({ feature_id: targetFeatureId, order: newOrder })
      .eq('id', epicId)
      .then(({ error }) => {
        if (error) {
          set({ error: error.message, storyMaps: prev })
        }
      })

    // Reorder epics in target feature
    const targetFeature = finalMaps
      .flatMap((m) => m.features)
      .find((f) => f.id === targetFeatureId)
    if (targetFeature) {
      debouncedReorder('epics', targetFeature.epics.map((e) => ({ id: e.id, order: e.order })))
    }
  },

  // Story CRUD
  addStory: async (epicId, releaseId = null) => {
    const userId = await getUserId()
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

    const { data, error } = await supabase
      .from('stories')
      .insert({ epic_id: epicId, user_id: userId, release_id: releaseId, order: storyCount })
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return null
    }

    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          epics: f.epics.map((e) =>
            e.id === epicId ? { ...e, stories: [...e.stories, data] } : e
          ),
        })),
      })),
    }))
    return data.id
  },

  updateStory: async (id, data) => {
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

    const { error } = await supabase.from('stories').update(data).eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchStoryMaps()
    }
  },

  deleteStory: async (id) => {
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

    const { error } = await supabase.from('stories').delete().eq('id', id)
    if (error) {
      set({ error: error.message, storyMaps: prev })
    }
  },

  reorderStories: (epicId, stories) => {
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
    debouncedReorder('stories', ordered.map((st) => ({ id: st.id, order: st.order })))
  },

  moveStory: (storyId, targetEpicId, releaseId, newOrder) => {
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

    supabase
      .from('stories')
      .update({ epic_id: targetEpicId, release_id: releaseId, order: newOrder })
      .eq('id', storyId)
      .then(({ error }) => {
        if (error) {
          set({ error: error.message, storyMaps: prev })
        }
      })

    const targetEpic = finalMaps
      .flatMap((m) => m.features)
      .flatMap((f) => f.epics)
      .find((e) => e.id === targetEpicId)
    if (targetEpic) {
      debouncedReorder('stories', targetEpic.stories.map((st) => ({ id: st.id, order: st.order })))
    }
  },

  // Release CRUD
  addRelease: async (storyMapId) => {
    const userId = await getUserId()
    const map = get().storyMaps.find((m) => m.id === storyMapId)
    const order = map ? map.releases.length : 0
    const colours = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6']
    const colour = colours[order % colours.length]

    const { data, error } = await supabase
      .from('releases')
      .insert({ story_map_id: storyMapId, user_id: userId, order, colour })
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return null
    }

    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, releases: [...m.releases, data] } : m
      ),
    }))
    return data.id
  },

  updateRelease: async (id, data) => {
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        releases: m.releases.map((r) => (r.id === id ? { ...r, ...data } : r)),
      })),
    }))

    const { error } = await supabase.from('releases').update(data).eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchStoryMaps()
    }
  },

  deleteRelease: async (id) => {
    const prev = get().storyMaps
    // Unassign stories from this release
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

    const { error } = await supabase.from('releases').delete().eq('id', id)
    if (error) {
      set({ error: error.message, storyMaps: prev })
    }
  },

  reorderReleases: (storyMapId, releases) => {
    const ordered = releases.map((r, i) => ({ ...r, order: i }))
    set((s) => ({
      storyMaps: s.storyMaps.map((m) =>
        m.id === storyMapId ? { ...m, releases: ordered } : m
      ),
    }))
    debouncedReorder('releases', ordered.map((r) => ({ id: r.id, order: r.order })))
  },

  // Promotion
  promoteStoryToEpic: async (storyId, targetFeatureId, newOrder) => {
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

    set({ storyMaps: updated })

    // Delete story from DB
    const { error: deleteError } = await supabase.from('stories').delete().eq('id', storyId)
    if (deleteError) {
      set({ error: deleteError.message, storyMaps: prev })
      return
    }

    // Create epic
    const userId = await getUserId()
    const { data: epicData, error: epicError } = await supabase
      .from('epics')
      .insert({
        feature_id: targetFeatureId,
        user_id: userId,
        title: story.title,
        description: story.description,
        acceptance_criteria: story.acceptance_criteria,
        order: newOrder,
      })
      .select()
      .single()

    if (epicError) {
      set({ error: epicError.message })
      await get().fetchStoryMaps()
      return
    }

    const newEpic: Epic = { ...epicData, stories: [] }
    set((s) => ({
      storyMaps: s.storyMaps.map((m) => ({
        ...m,
        features: m.features.map((f) => {
          if (f.id === targetFeatureId) {
            const epics = [...f.epics]
            epics.splice(newOrder, 0, newEpic)
            return { ...f, epics: epics.map((e, i) => ({ ...e, order: i })) }
          }
          return f
        }),
      })),
    }))
  },
}))
