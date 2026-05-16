/**
 * Shared base for adapters that persist each story map as a single
 * denormalised snapshot (all features/epics/stories/releases nested).
 *
 * The 22 StorageAdapter methods are mechanical: an entity mutation just
 * means "persist the map that contains it" (debounced 300ms to batch
 * rapid edits), and create/delete-map persist/remove the snapshot
 * directly. Where that snapshot is read/written is the only difference
 * between backends, so it is injected as a `MapSnapshotSink`.
 *
 * State (debounce table, maps reference) is PER INSTANCE so two live
 * adapters during a hot-swap never share a debounce table.
 */

import type { StorageAdapter } from './StorageAdapter'
import type { StoryMap, Feature, Epic, Story, Release } from '../../types'

export interface MapSnapshotSink {
  /** Load all maps (sorted as the app expects, newest first). */
  loadAll(): Promise<StoryMap[]>
  /** Persist one full map snapshot. */
  persistMap(map: StoryMap): Promise<void>
  /** Remove one map's snapshot. */
  removeMap(id: string): Promise<void>
}

export abstract class MapSnapshotAdapterBase implements StorageAdapter {
  /** Backend-specific read/write sink. Provided by the subclass. */
  protected abstract sink: MapSnapshotSink

  private pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

  /**
   * Reference to the current in-memory maps so mutation helpers can look
   * up and persist the full map object. The store sets this via
   * `_setMapsRef` after every state change.
   */
  private mapsRef: () => StoryMap[] = () => []

  /** Save a map after a short delay to batch rapid edits. */
  private debouncedSave(map: StoryMap) {
    const existing = this.pendingWrites.get(map.id)
    if (existing) clearTimeout(existing)
    this.pendingWrites.set(
      map.id,
      setTimeout(() => {
        this.pendingWrites.delete(map.id)
        this.sink.persistMap({ ...map, updated_at: new Date().toISOString() })
      }, 300)
    )
  }

  private findMapContaining(
    predicate: (m: StoryMap) => boolean
  ): StoryMap | undefined {
    return this.mapsRef().find(predicate)
  }

  private persistMapContaining(
    entityId: string,
    table: 'features' | 'epics' | 'stories' | 'releases'
  ) {
    const map = this.mapsRef().find((m) => {
      if (table === 'features') return m.features.some((f) => f.id === entityId)
      if (table === 'releases') return m.releases.some((r) => r.id === entityId)
      if (table === 'epics')
        return m.features.some((f) => f.epics.some((e) => e.id === entityId))
      if (table === 'stories')
        return m.features.some((f) =>
          f.epics.some((e) => e.stories.some((s) => s.id === entityId))
        )
      return false
    })
    if (map) this.debouncedSave(map)
  }

  /**
   * Called by the store so the adapter can read current state for
   * persistence without creating a circular dependency.
   */
  _setMapsRef(getter: () => StoryMap[]) {
    this.mapsRef = getter
  }

  async init(): Promise<StoryMap[]> {
    return this.sink.loadAll()
  }

  /* ---- story map CRUD ---- */

  async createMap(map: StoryMap): Promise<void> {
    await this.sink.persistMap(map)
  }

  async updateMap(
    id: string,
    data: Partial<Pick<StoryMap, 'name'>>
  ): Promise<void> {
    const map = this.findMapContaining((m) => m.id === id)
    if (map) this.debouncedSave({ ...map, ...data })
  }

  async deleteMap(id: string): Promise<void> {
    await this.sink.removeMap(id)
  }

  /* ---- feature CRUD ---- */

  async createFeature(feature: Feature): Promise<void> {
    const map = this.findMapContaining((m) => m.id === feature.story_map_id)
    if (map) this.debouncedSave(map)
  }

  async updateFeature(
    _id: string,
    _data: Partial<Pick<Feature, 'title' | 'description' | 'acceptance_criteria'>>
  ): Promise<void> {
    this.persistMapContaining(_id, 'features')
  }

  async deleteFeature(_id: string): Promise<void> {
    // The store has already removed the entity from state, so it can no
    // longer be looked up by id -- persist every currently-known map.
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }

  reorderFeatures(items: { id: string; order: number }[]): void {
    if (items.length > 0) this.persistMapContaining(items[0].id, 'features')
  }

  /* ---- epic CRUD ---- */

  async createEpic(epic: Epic): Promise<void> {
    this.persistMapContaining(epic.feature_id, 'features')
  }

  async updateEpic(id: string): Promise<void> {
    this.persistMapContaining(id, 'epics')
  }

  async deleteEpic(_id: string): Promise<void> {
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }

  reorderEpics(items: { id: string; order: number }[]): void {
    if (items.length > 0) this.persistMapContaining(items[0].id, 'epics')
  }

  async moveEpic(_epicId: string, _targetFeatureId: string): Promise<void> {
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }

  /* ---- story CRUD ---- */

  async createStory(story: Story): Promise<void> {
    this.persistMapContaining(story.epic_id, 'epics')
  }

  async updateStory(id: string): Promise<void> {
    this.persistMapContaining(id, 'stories')
  }

  async deleteStory(_id: string): Promise<void> {
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }

  reorderStories(items: { id: string; order: number }[]): void {
    if (items.length > 0) this.persistMapContaining(items[0].id, 'stories')
  }

  async moveStory(): Promise<void> {
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }

  /* ---- release CRUD ---- */

  async createRelease(release: Release): Promise<void> {
    const map = this.findMapContaining((m) => m.id === release.story_map_id)
    if (map) this.debouncedSave(map)
  }

  async updateRelease(id: string): Promise<void> {
    this.persistMapContaining(id, 'releases')
  }

  async deleteRelease(_id: string): Promise<void> {
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }

  reorderReleases(items: { id: string; order: number }[]): void {
    if (items.length > 0) this.persistMapContaining(items[0].id, 'releases')
  }

  /* ---- promotion ---- */

  async promoteStoryToEpic(): Promise<void> {
    this.mapsRef().forEach((m) => this.debouncedSave(m))
  }
}
