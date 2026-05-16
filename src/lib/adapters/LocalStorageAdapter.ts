/**
 * Local-first storage adapter backed by IndexedDB.
 *
 * Each story map is stored as a single denormalised record (with all
 * features, epics, stories, and releases nested inside) so there are
 * no relational queries at the storage level.
 *
 * Writes are debounced -- the in-memory Zustand store is the source of
 * truth and IndexedDB is kept in sync asynchronously.
 */

import type { StorageAdapter } from './StorageAdapter'
import type { StoryMap, Feature, Epic, Story, Release } from '../../types'
import * as db from '../storage/IndexedDB'

const LOCAL_USER_ID = 'local'

/** Save a map to IndexedDB after a short delay to batch rapid edits. */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

function debouncedSave(map: StoryMap) {
  const existing = pendingWrites.get(map.id)
  if (existing) clearTimeout(existing)
  pendingWrites.set(
    map.id,
    setTimeout(() => {
      pendingWrites.delete(map.id)
      db.putMap({ ...map, updated_at: new Date().toISOString() })
    }, 300)
  )
}

/**
 * We need a reference to the current in-memory maps so that mutation
 * helpers can look up and persist the full map object.  The store sets
 * this via `_setMapsRef` after every state change.
 */
let mapsRef: () => StoryMap[] = () => []

function findMapContaining(predicate: (m: StoryMap) => boolean): StoryMap | undefined {
  return mapsRef().find(predicate)
}

function persistMapContaining(entityId: string, table: 'features' | 'epics' | 'stories' | 'releases') {
  const map = mapsRef().find((m) => {
    if (table === 'features') return m.features.some((f) => f.id === entityId)
    if (table === 'releases') return m.releases.some((r) => r.id === entityId)
    if (table === 'epics') return m.features.some((f) => f.epics.some((e) => e.id === entityId))
    if (table === 'stories') return m.features.some((f) => f.epics.some((e) => e.stories.some((s) => s.id === entityId)))
    return false
  })
  if (map) debouncedSave(map)
}

export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Called by the store so the adapter can read current state for
   * persistence without creating a circular dependency.
   */
  _setMapsRef(getter: () => StoryMap[]) {
    mapsRef = getter
  }

  async init(): Promise<StoryMap[]> {
    return db.getAllMaps()
  }

  /* ---- story map CRUD ---- */

  async createMap(map: StoryMap): Promise<void> {
    await db.putMap(map)
  }

  async updateMap(id: string, data: Partial<Pick<StoryMap, 'name'>>): Promise<void> {
    const map = findMapContaining((m) => m.id === id)
    if (map) debouncedSave({ ...map, ...data })
  }

  async deleteMap(id: string): Promise<void> {
    await db.deleteMap(id)
  }

  /* ---- feature CRUD ---- */

  async createFeature(feature: Feature): Promise<void> {
    const map = findMapContaining((m) => m.id === feature.story_map_id)
    if (map) debouncedSave(map)
  }

  async updateFeature(_id: string, _data: Partial<Pick<Feature, 'title' | 'description' | 'acceptance_criteria'>>): Promise<void> {
    persistMapContaining(_id, 'features')
  }

  async deleteFeature(_id: string): Promise<void> {
    // Map state is already updated by the store; just persist.
    // After the optimistic delete the feature is gone, so we cannot
    // look it up by id -- the store calls this after updating its own
    // state, so we persist every currently-known map.
    mapsRef().forEach((m) => debouncedSave(m))
  }

  reorderFeatures(items: { id: string; order: number }[]): void {
    if (items.length > 0) persistMapContaining(items[0].id, 'features')
  }

  /* ---- epic CRUD ---- */

  async createEpic(epic: Epic): Promise<void> {
    persistMapContaining(epic.feature_id, 'features')
  }

  async updateEpic(id: string): Promise<void> {
    persistMapContaining(id, 'epics')
  }

  async deleteEpic(_id: string): Promise<void> {
    mapsRef().forEach((m) => debouncedSave(m))
  }

  reorderEpics(items: { id: string; order: number }[]): void {
    if (items.length > 0) persistMapContaining(items[0].id, 'epics')
  }

  async moveEpic(_epicId: string, _targetFeatureId: string): Promise<void> {
    mapsRef().forEach((m) => debouncedSave(m))
  }

  /* ---- story CRUD ---- */

  async createStory(story: Story): Promise<void> {
    persistMapContaining(story.epic_id, 'epics')
  }

  async updateStory(id: string): Promise<void> {
    persistMapContaining(id, 'stories')
  }

  async deleteStory(_id: string): Promise<void> {
    mapsRef().forEach((m) => debouncedSave(m))
  }

  reorderStories(items: { id: string; order: number }[]): void {
    if (items.length > 0) persistMapContaining(items[0].id, 'stories')
  }

  async moveStory(): Promise<void> {
    mapsRef().forEach((m) => debouncedSave(m))
  }

  /* ---- release CRUD ---- */

  async createRelease(release: Release): Promise<void> {
    const map = findMapContaining((m) => m.id === release.story_map_id)
    if (map) debouncedSave(map)
  }

  async updateRelease(id: string): Promise<void> {
    persistMapContaining(id, 'releases')
  }

  async deleteRelease(_id: string): Promise<void> {
    mapsRef().forEach((m) => debouncedSave(m))
  }

  reorderReleases(items: { id: string; order: number }[]): void {
    if (items.length > 0) persistMapContaining(items[0].id, 'releases')
  }

  /* ---- promotion ---- */

  async promoteStoryToEpic(): Promise<void> {
    mapsRef().forEach((m) => debouncedSave(m))
  }
}

/** Helper used by the store to generate UUIDs and timestamps. */
export { LOCAL_USER_ID }
