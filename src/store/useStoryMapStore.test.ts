import { describe, it, expect, beforeEach } from 'vitest'
import type { StorageAdapter } from '../lib/adapters'
import type { StoryMap } from '../types'

// ---------------------------------------------------------------------------
// In-memory storage adapter
//
// The store is the single source of truth; adapters only mirror state for
// persistence. This adapter implements the same contract as
// LocalStorageAdapter (including the `_setMapsRef` hook the store uses to
// wire up a live reference) but keeps everything in memory so tests are
// deterministic and free of IndexedDB/Supabase.
// ---------------------------------------------------------------------------
function createMemoryAdapter(): StorageAdapter & { _setMapsRef: (g: () => StoryMap[]) => void } {
  let mapsRef: () => StoryMap[] = () => []
  let snapshot: StoryMap[] = []

  // Re-capture a deep clone of the store's current maps. Called after every
  // mutation, exactly mirroring how the real local adapter persists.
  const persist = () => {
    snapshot = structuredClone(mapsRef())
  }

  return {
    _setMapsRef(getter) {
      mapsRef = getter
    },
    async init() {
      return structuredClone(snapshot).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    },
    async createMap() { persist() },
    async updateMap() { persist() },
    async deleteMap() { persist() },
    async createFeature() { persist() },
    async updateFeature() { persist() },
    async deleteFeature() { persist() },
    reorderFeatures() { persist() },
    async createEpic() { persist() },
    async updateEpic() { persist() },
    async deleteEpic() { persist() },
    reorderEpics() { persist() },
    async moveEpic() { persist() },
    async createStory() { persist() },
    async updateStory() { persist() },
    async deleteStory() { persist() },
    reorderStories() { persist() },
    async moveStory() { persist() },
    async createRelease() { persist() },
    async updateRelease() { persist() },
    async deleteRelease() { persist() },
    reorderReleases() { persist() },
    async promoteStoryToEpic() { persist() },
  }
}

import { useStoryMapStore } from './useStoryMapStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getState = () => useStoryMapStore.getState()
const findMap = (id: string) => getState().storyMaps.find((m) => m.id === id)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useStoryMapStore', () => {
  beforeEach(async () => {
    useStoryMapStore.setState({
      storyMaps: [],
      currentMapId: null,
      loading: false,
      error: null,
      adapter: null,
    })
    // A fresh adapter per test => isolated, empty persistence.
    await getState().initAdapter(createMemoryAdapter())
  })

  // ─── swapAdapter (FSA hot-swap) ────────────────────────────────────
  describe('swapAdapter', () => {
    it('installs the new adapter, replaces maps and tags it fs', () => {
      const next = createMemoryAdapter()
      const maps = [
        {
          id: 'm1', user_id: 'local', name: 'On disk',
          features: [], releases: [],
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]
      getState().setCurrentMap('m1')

      getState().swapAdapter(next, maps)

      expect(getState().adapter).toBe(next)
      expect(getState().storyMaps).toEqual(maps)
      expect(getState().adapterKind).toBe('fs')
      expect(getState().currentMapId).toBe('m1') // screen not torn down
    })

    it('never flips loading (would unmount the screen)', () => {
      const seen: boolean[] = []
      const unsub = useStoryMapStore.subscribe((s) => seen.push(s.loading))

      getState().swapAdapter(createMemoryAdapter(), [])
      unsub()

      expect(seen.every((l) => l === false)).toBe(true)
      expect(getState().loading).toBe(false)
    })

    it('routes subsequent persistence to the new adapter', async () => {
      let oldCalls = 0
      let newCalls = 0
      const old = getState().adapter as StorageAdapter & {
        createMap: () => Promise<void>
      }
      old.createMap = async () => { oldCalls++ }
      const next = createMemoryAdapter()
      next.createMap = async () => { newCalls++ }

      getState().swapAdapter(next, [])
      await getState().createStoryMap('After swap')

      expect(newCalls).toBe(1)
      expect(oldCalls).toBe(0)
    })

    it('wires _setMapsRef on the new adapter', () => {
      let wired = false
      const next = createMemoryAdapter()
      const origSet = next._setMapsRef
      next._setMapsRef = (g) => { wired = true; origSet(g) }

      getState().swapAdapter(next, [])

      expect(wired).toBe(true)
    })
  })

  // ─── State management ──────────────────────────────────────────────
  describe('state management', () => {
    it('setCurrentMap updates currentMapId', () => {
      getState().setCurrentMap('map-1')
      expect(getState().currentMapId).toBe('map-1')
    })

    it('setCurrentMap can be set to null', () => {
      getState().setCurrentMap('map-1')
      getState().setCurrentMap(null)
      expect(getState().currentMapId).toBeNull()
    })

    it('getCurrentMap returns the correct map', () => {
      const map = {
        id: 'map-1',
        user_id: 'u',
        name: 'Test',
        features: [],
        releases: [],
        created_at: '',
        updated_at: '',
      }
      useStoryMapStore.setState({ storyMaps: [map], currentMapId: 'map-1' })
      expect(getState().getCurrentMap()).toEqual(map)
    })

    it('getCurrentMap returns undefined when no current map', () => {
      expect(getState().getCurrentMap()).toBeUndefined()
    })

    it('setError updates error state', () => {
      getState().setError('Something went wrong')
      expect(getState().error).toBe('Something went wrong')
    })

    it('setError clears error when passed null', () => {
      getState().setError('error')
      getState().setError(null)
      expect(getState().error).toBeNull()
    })
  })

  // ─── Story Map CRUD ────────────────────────────────────────────────
  describe('story map CRUD', () => {
    it('fetchStoryMaps populates storyMaps', async () => {
      await getState().createStoryMap('Map A')
      await getState().createStoryMap('Map B')
      useStoryMapStore.setState({ storyMaps: [] })

      await getState().fetchStoryMaps()
      expect(getState().storyMaps).toHaveLength(2)
    })

    it('fetchStoryMaps sets loading during fetch', async () => {
      const promise = getState().fetchStoryMaps()
      expect(getState().loading).toBe(true)
      await promise
      expect(getState().loading).toBe(false)
    })

    it('createStoryMap adds a new map to state', async () => {
      await getState().createStoryMap('My Map')
      expect(getState().storyMaps).toHaveLength(1)
      expect(getState().storyMaps[0].name).toBe('My Map')
    })

    it('createStoryMap returns the new map ID', async () => {
      const id = await getState().createStoryMap('Test')
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('createStoryMap uses default name when not provided', async () => {
      await getState().createStoryMap()
      expect(getState().storyMaps[0].name).toBe('Untitled Map')
    })

    it('createStoryMap initializes with empty features and releases', async () => {
      await getState().createStoryMap('Test')
      expect(getState().storyMaps[0].features).toEqual([])
      expect(getState().storyMaps[0].releases).toEqual([])
    })

    it('updateStoryMapName optimistically updates', async () => {
      const id = await getState().createStoryMap('Original')
      await getState().updateStoryMapName(id!, 'Updated')
      expect(getState().storyMaps[0].name).toBe('Updated')
    })

    it('deleteStoryMap removes map from state', async () => {
      const id = await getState().createStoryMap('To Delete')
      await getState().deleteStoryMap(id!)
      expect(getState().storyMaps).toHaveLength(0)
    })

    it('deleteStoryMap clears currentMapId when active map deleted', async () => {
      const id = await getState().createStoryMap('Active')
      getState().setCurrentMap(id!)
      await getState().deleteStoryMap(id!)
      expect(getState().currentMapId).toBeNull()
    })

    it('deleteStoryMap preserves currentMapId when other map deleted', async () => {
      const id1 = await getState().createStoryMap('Map 1')
      const id2 = await getState().createStoryMap('Map 2')
      getState().setCurrentMap(id1!)
      await getState().deleteStoryMap(id2!)
      expect(getState().currentMapId).toBe(id1)
    })

    it('duplicateStoryMap creates copy with (copy) suffix', async () => {
      const id = await getState().createStoryMap('Original')
      await getState().duplicateStoryMap(id!)
      const maps = getState().storyMaps
      expect(maps.some((m) => m.name === 'Original (copy)')).toBe(true)
    })

    it('duplicateStoryMap copies nested features and epics', async () => {
      const mapId = (await getState().createStoryMap('Source'))!
      const fId = (await getState().addFeature(mapId))!
      await getState().updateFeature(fId, { title: 'Feature A' })
      const eId = (await getState().addEpic(fId))!
      await getState().updateEpic(eId, { title: 'Epic 1' })

      await getState().duplicateStoryMap(mapId)

      const copy = getState().storyMaps.find((m) => m.name === 'Source (copy)')
      expect(copy).toBeTruthy()
      expect(copy!.features).toHaveLength(1)
      expect(copy!.features[0].title).toBe('Feature A')
      expect(copy!.features[0].epics).toHaveLength(1)
      expect(copy!.features[0].epics[0].title).toBe('Epic 1')
    })
  })

  // ─── Feature CRUD ──────────────────────────────────────────────────
  describe('feature CRUD', () => {
    let mapId: string

    beforeEach(async () => {
      mapId = (await getState().createStoryMap('Test Map'))!
    })

    it('addFeature appends to map features', async () => {
      await getState().addFeature(mapId)
      expect(findMap(mapId)?.features).toHaveLength(1)
    })

    it('addFeature returns the new feature ID', async () => {
      const id = await getState().addFeature(mapId)
      expect(id).toBeTruthy()
    })

    it('addFeature sets correct order for multiple features', async () => {
      await getState().addFeature(mapId)
      await getState().addFeature(mapId)
      const map = findMap(mapId)!
      expect(map.features[0].order).toBe(0)
      expect(map.features[1].order).toBe(1)
    })

    it('addFeature initializes with empty epics', async () => {
      await getState().addFeature(mapId)
      expect(findMap(mapId)?.features[0].epics).toEqual([])
    })

    it('addFeature uses default title', async () => {
      await getState().addFeature(mapId)
      expect(findMap(mapId)?.features[0].title).toBe('New Feature')
    })

    it('updateFeature optimistically updates title', async () => {
      const fId = (await getState().addFeature(mapId))!
      await getState().updateFeature(fId, { title: 'Updated Title' })
      expect(findMap(mapId)?.features[0].title).toBe('Updated Title')
    })

    it('updateFeature updates description and acceptance_criteria', async () => {
      const fId = (await getState().addFeature(mapId))!
      await getState().updateFeature(fId, {
        description: 'Desc',
        acceptance_criteria: 'AC',
      })
      const f = findMap(mapId)?.features[0]
      expect(f?.description).toBe('Desc')
      expect(f?.acceptance_criteria).toBe('AC')
    })

    it('deleteFeature removes from map', async () => {
      const fId = (await getState().addFeature(mapId))!
      await getState().deleteFeature(fId)
      expect(findMap(mapId)?.features).toHaveLength(0)
    })

    it('reorderFeatures updates order indices', async () => {
      const fId1 = (await getState().addFeature(mapId))!
      const fId2 = (await getState().addFeature(mapId))!
      const map = findMap(mapId)!
      const reversed = [map.features[1], map.features[0]]
      getState().reorderFeatures(mapId, reversed)

      const updated = findMap(mapId)!
      expect(updated.features[0].id).toBe(fId2)
      expect(updated.features[0].order).toBe(0)
      expect(updated.features[1].id).toBe(fId1)
      expect(updated.features[1].order).toBe(1)
    })
  })

  // ─── Epic CRUD ─────────────────────────────────────────────────────
  describe('epic CRUD', () => {
    let mapId: string
    let featureId: string

    beforeEach(async () => {
      mapId = (await getState().createStoryMap('Test Map'))!
      featureId = (await getState().addFeature(mapId))!
    })

    it('addEpic appends to feature epics', async () => {
      await getState().addEpic(featureId)
      expect(findMap(mapId)?.features[0].epics).toHaveLength(1)
    })

    it('addEpic returns the new epic ID', async () => {
      const id = await getState().addEpic(featureId)
      expect(id).toBeTruthy()
    })

    it('addEpic sets correct order for multiple epics', async () => {
      await getState().addEpic(featureId)
      await getState().addEpic(featureId)
      const epics = findMap(mapId)!.features[0].epics
      expect(epics[0].order).toBe(0)
      expect(epics[1].order).toBe(1)
    })

    it('addEpic initializes with empty stories', async () => {
      await getState().addEpic(featureId)
      expect(findMap(mapId)?.features[0].epics[0].stories).toEqual([])
    })

    it('updateEpic optimistically updates', async () => {
      const eId = (await getState().addEpic(featureId))!
      await getState().updateEpic(eId, { title: 'Updated Epic' })
      expect(findMap(mapId)?.features[0].epics[0].title).toBe('Updated Epic')
    })

    it('deleteEpic removes from feature', async () => {
      const eId = (await getState().addEpic(featureId))!
      await getState().deleteEpic(eId)
      expect(findMap(mapId)?.features[0].epics).toHaveLength(0)
    })

    it('reorderEpics updates order indices', async () => {
      const eId1 = (await getState().addEpic(featureId))!
      const eId2 = (await getState().addEpic(featureId))!
      const feature = findMap(mapId)!.features[0]
      const reversed = [feature.epics[1], feature.epics[0]]
      getState().reorderEpics(featureId, reversed)

      const updated = findMap(mapId)!.features[0]
      expect(updated.epics[0].id).toBe(eId2)
      expect(updated.epics[0].order).toBe(0)
      expect(updated.epics[1].id).toBe(eId1)
      expect(updated.epics[1].order).toBe(1)
    })

    it('moveEpic moves epic to another feature', async () => {
      const feature2Id = (await getState().addFeature(mapId))!
      const epicId = (await getState().addEpic(featureId))!

      getState().moveEpic(epicId, feature2Id, 0)

      const map = findMap(mapId)!
      expect(map.features[0].epics).toHaveLength(0)
      expect(map.features[1].epics).toHaveLength(1)
      expect(map.features[1].epics[0].id).toBe(epicId)
    })

    it('moveEpic preserves child stories', async () => {
      const feature2Id = (await getState().addFeature(mapId))!
      const epicId = (await getState().addEpic(featureId))!
      await getState().addStory(epicId)

      getState().moveEpic(epicId, feature2Id, 0)

      const map = findMap(mapId)!
      expect(map.features[1].epics[0].stories).toHaveLength(1)
    })

    it('moveEpic updates order of target feature epics', async () => {
      const feature2Id = (await getState().addFeature(mapId))!
      await getState().addEpic(feature2Id) // existing epic at order 0
      const epicId = (await getState().addEpic(featureId))!

      getState().moveEpic(epicId, feature2Id, 0)

      const map = findMap(mapId)!
      const targetEpics = map.features[1].epics
      expect(targetEpics[0].id).toBe(epicId)
      expect(targetEpics[0].order).toBe(0)
      expect(targetEpics[1].order).toBe(1)
    })
  })

  // ─── Story CRUD ────────────────────────────────────────────────────
  describe('story CRUD', () => {
    let mapId: string
    let featureId: string
    let epicId: string

    beforeEach(async () => {
      mapId = (await getState().createStoryMap('Test Map'))!
      featureId = (await getState().addFeature(mapId))!
      epicId = (await getState().addEpic(featureId))!
    })

    it('addStory appends to epic stories', async () => {
      await getState().addStory(epicId)
      expect(findMap(mapId)?.features[0].epics[0].stories).toHaveLength(1)
    })

    it('addStory returns the new story ID', async () => {
      const id = await getState().addStory(epicId)
      expect(id).toBeTruthy()
    })

    it('addStory with releaseId sets release_id', async () => {
      const relId = (await getState().addRelease(mapId))!
      await getState().addStory(epicId, relId)
      expect(findMap(mapId)?.features[0].epics[0].stories[0].release_id).toBe(relId)
    })

    it('addStory without releaseId sets release_id to null', async () => {
      await getState().addStory(epicId)
      expect(findMap(mapId)?.features[0].epics[0].stories[0].release_id).toBeNull()
    })

    it('addStory uses default title', async () => {
      await getState().addStory(epicId)
      expect(findMap(mapId)?.features[0].epics[0].stories[0].title).toBe('New Story')
    })

    it('updateStory optimistically updates title', async () => {
      const sId = (await getState().addStory(epicId))!
      await getState().updateStory(sId, { title: 'Updated Story' })
      expect(findMap(mapId)?.features[0].epics[0].stories[0].title).toBe('Updated Story')
    })

    it('updateStory can change release_id', async () => {
      const relId = (await getState().addRelease(mapId))!
      const sId = (await getState().addStory(epicId))!
      await getState().updateStory(sId, { release_id: relId })
      expect(findMap(mapId)?.features[0].epics[0].stories[0].release_id).toBe(relId)
    })

    it('deleteStory removes from epic', async () => {
      const sId = (await getState().addStory(epicId))!
      await getState().deleteStory(sId)
      expect(findMap(mapId)?.features[0].epics[0].stories).toHaveLength(0)
    })

    it('reorderStories updates order indices', async () => {
      const sId1 = (await getState().addStory(epicId))!
      const sId2 = (await getState().addStory(epicId))!
      const stories = findMap(mapId)!.features[0].epics[0].stories
      const reversed = [stories[1], stories[0]]
      getState().reorderStories(epicId, reversed)

      const updated = findMap(mapId)!.features[0].epics[0].stories
      expect(updated[0].id).toBe(sId2)
      expect(updated[0].order).toBe(0)
      expect(updated[1].id).toBe(sId1)
      expect(updated[1].order).toBe(1)
    })

    it('moveStory moves to another epic', async () => {
      const epic2Id = (await getState().addEpic(featureId))!
      const sId = (await getState().addStory(epicId))!

      getState().moveStory(sId, epic2Id, null, 0)

      const map = findMap(mapId)!
      expect(map.features[0].epics[0].stories).toHaveLength(0)
      expect(map.features[0].epics[1].stories).toHaveLength(1)
    })

    it('moveStory updates release_id', async () => {
      const relId = (await getState().addRelease(mapId))!
      const epic2Id = (await getState().addEpic(featureId))!
      const sId = (await getState().addStory(epicId))!

      getState().moveStory(sId, epic2Id, relId, 0)

      const map = findMap(mapId)!
      expect(map.features[0].epics[1].stories[0].release_id).toBe(relId)
    })

    it('moveStory maintains order in target epic', async () => {
      const epic2Id = (await getState().addEpic(featureId))!
      await getState().addStory(epic2Id) // existing story
      const sId = (await getState().addStory(epicId))!

      getState().moveStory(sId, epic2Id, null, 0)

      const targetStories = findMap(mapId)!.features[0].epics[1].stories
      expect(targetStories).toHaveLength(2)
      expect(targetStories[0].id).toBe(sId)
      expect(targetStories[0].order).toBe(0)
      expect(targetStories[1].order).toBe(1)
    })
  })

  // ─── Release CRUD ──────────────────────────────────────────────────
  describe('release CRUD', () => {
    let mapId: string

    beforeEach(async () => {
      mapId = (await getState().createStoryMap('Test Map'))!
    })

    it('addRelease appends to map releases', async () => {
      await getState().addRelease(mapId)
      expect(findMap(mapId)?.releases).toHaveLength(1)
    })

    it('addRelease returns the new release ID', async () => {
      const id = await getState().addRelease(mapId)
      expect(id).toBeTruthy()
    })

    it('addRelease assigns cyclic colours from palette', async () => {
      const palette = [
        '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
        '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
      ]
      for (let i = 0; i < palette.length; i++) {
        await getState().addRelease(mapId)
      }
      const map = findMap(mapId)!
      for (let i = 0; i < palette.length; i++) {
        expect(map.releases[i].colour).toBe(palette[i])
      }
    })

    it('addRelease wraps colours after palette length', async () => {
      for (let i = 0; i < 11; i++) {
        await getState().addRelease(mapId)
      }
      expect(findMap(mapId)!.releases[10].colour).toBe('#6366F1')
    })

    it('addRelease uses default name', async () => {
      await getState().addRelease(mapId)
      expect(findMap(mapId)?.releases[0].name).toBe('New Release')
    })

    it('updateRelease changes name', async () => {
      const rId = (await getState().addRelease(mapId))!
      await getState().updateRelease(rId, { name: 'Sprint 1' })
      expect(findMap(mapId)?.releases[0].name).toBe('Sprint 1')
    })

    it('updateRelease changes colour', async () => {
      const rId = (await getState().addRelease(mapId))!
      await getState().updateRelease(rId, { colour: '#FF0000' })
      expect(findMap(mapId)?.releases[0].colour).toBe('#FF0000')
    })

    it('deleteRelease removes from map', async () => {
      const rId = (await getState().addRelease(mapId))!
      await getState().deleteRelease(rId)
      expect(findMap(mapId)?.releases).toHaveLength(0)
    })

    it('deleteRelease unassigns stories with that release', async () => {
      const rId = (await getState().addRelease(mapId))!
      const fId = (await getState().addFeature(mapId))!
      const eId = (await getState().addEpic(fId))!
      await getState().addStory(eId, rId)

      // Verify story has release
      expect(findMap(mapId)!.features[0].epics[0].stories[0].release_id).toBe(rId)

      await getState().deleteRelease(rId)

      expect(findMap(mapId)!.features[0].epics[0].stories[0].release_id).toBeNull()
    })

    it('reorderReleases updates order indices', async () => {
      const rId1 = (await getState().addRelease(mapId))!
      const rId2 = (await getState().addRelease(mapId))!
      const map = findMap(mapId)!
      const reversed = [map.releases[1], map.releases[0]]
      getState().reorderReleases(mapId, reversed)

      const updated = findMap(mapId)!
      expect(updated.releases[0].id).toBe(rId2)
      expect(updated.releases[0].order).toBe(0)
      expect(updated.releases[1].id).toBe(rId1)
      expect(updated.releases[1].order).toBe(1)
    })
  })

  // ─── Promotion ─────────────────────────────────────────────────────
  describe('promotion', () => {
    let mapId: string
    let featureId: string
    let epicId: string

    beforeEach(async () => {
      mapId = (await getState().createStoryMap('Test Map'))!
      featureId = (await getState().addFeature(mapId))!
      epicId = (await getState().addEpic(featureId))!
    })

    it('promoteStoryToEpic removes the story', async () => {
      const sId = (await getState().addStory(epicId))!
      await getState().promoteStoryToEpic(sId, featureId, 1)

      expect(findMap(mapId)!.features[0].epics[0].stories).toHaveLength(0)
    })

    it('promoteStoryToEpic creates epic with story content', async () => {
      const sId = (await getState().addStory(epicId))!
      await getState().updateStory(sId, {
        title: 'Important Story',
        description: 'Story desc',
        acceptance_criteria: 'Story AC',
      })

      await getState().promoteStoryToEpic(sId, featureId, 1)

      const epics = findMap(mapId)!.features[0].epics
      const newEpic = epics.find((e) => e.title === 'Important Story')
      expect(newEpic).toBeTruthy()
      expect(newEpic?.description).toBe('Story desc')
      expect(newEpic?.acceptance_criteria).toBe('Story AC')
    })

    it('promoteStoryToEpic inserts at specified order', async () => {
      const sId = (await getState().addStory(epicId))!
      await getState().updateStory(sId, { title: 'To Promote' })

      await getState().promoteStoryToEpic(sId, featureId, 0)

      const epics = findMap(mapId)!.features[0].epics
      expect(epics[0].title).toBe('To Promote')
    })

    it('promoteStoryToEpic creates epic with empty stories array', async () => {
      const sId = (await getState().addStory(epicId))!

      await getState().promoteStoryToEpic(sId, featureId, 1)

      const epics = findMap(mapId)!.features[0].epics
      const promoted = epics[epics.length - 1]
      expect(promoted.stories).toEqual([])
    })
  })

  // ─── Data integrity ────────────────────────────────────────────────
  describe('data integrity', () => {
    it('full hierarchy: map → features → epics → stories', async () => {
      const mId = (await getState().createStoryMap('Full Test'))!
      const f1 = (await getState().addFeature(mId))!
      const f2 = (await getState().addFeature(mId))!
      const e1 = (await getState().addEpic(f1))!
      const e2 = (await getState().addEpic(f1))!
      const e3 = (await getState().addEpic(f2))!
      await getState().addStory(e1)
      await getState().addStory(e1)
      await getState().addStory(e2)
      await getState().addStory(e3)

      const map = findMap(mId)!
      expect(map.features).toHaveLength(2)
      expect(map.features[0].epics).toHaveLength(2)
      expect(map.features[0].epics[0].stories).toHaveLength(2)
      expect(map.features[0].epics[1].stories).toHaveLength(1)
      expect(map.features[1].epics).toHaveLength(1)
      expect(map.features[1].epics[0].stories).toHaveLength(1)
    })

    it('multiple maps maintain separate data', async () => {
      const map1 = (await getState().createStoryMap('Map 1'))!
      const map2 = (await getState().createStoryMap('Map 2'))!
      await getState().addFeature(map1)
      await getState().addFeature(map1)
      await getState().addFeature(map2)

      expect(findMap(map1)!.features).toHaveLength(2)
      expect(findMap(map2)!.features).toHaveLength(1)
    })

    it('deleting a feature does not affect other features', async () => {
      const mId = (await getState().createStoryMap('Test'))!
      const f1 = (await getState().addFeature(mId))!
      const f2 = (await getState().addFeature(mId))!
      await getState().addEpic(f1)
      await getState().addEpic(f2)

      await getState().deleteFeature(f1)

      const map = findMap(mId)!
      expect(map.features).toHaveLength(1)
      expect(map.features[0].id).toBe(f2)
      expect(map.features[0].epics).toHaveLength(1)
    })

    it('stories with releases retain release_id after move', async () => {
      const mId = (await getState().createStoryMap('Test'))!
      const rId = (await getState().addRelease(mId))!
      const fId = (await getState().addFeature(mId))!
      const e1 = (await getState().addEpic(fId))!
      const e2 = (await getState().addEpic(fId))!
      const sId = (await getState().addStory(e1, rId))!

      getState().moveStory(sId, e2, rId, 0)

      const story = findMap(mId)!.features[0].epics[1].stories[0]
      expect(story.release_id).toBe(rId)
    })
  })
})
