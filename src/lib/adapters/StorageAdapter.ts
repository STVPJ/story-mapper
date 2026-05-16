import type { StoryMap, Feature, Epic, Story, Release } from '../../types'

/**
 * Storage adapter interface.
 *
 * Implement this to plug in any persistence backend (IndexedDB, Supabase,
 * Firebase, a custom REST API, etc.). The default shipped adapter is
 * `LocalStorageAdapter` which uses IndexedDB and requires no server.
 */
export interface StorageAdapter {
  /* ---- lifecycle ---- */
  /** Called once when the store initialises. Load all maps here. */
  init(): Promise<StoryMap[]>

  /* ---- story map CRUD ---- */
  createMap(map: StoryMap): Promise<void>
  updateMap(id: string, data: Partial<Pick<StoryMap, 'name'>>): Promise<void>
  deleteMap(id: string): Promise<void>

  /* ---- feature CRUD ---- */
  createFeature(feature: Feature): Promise<void>
  updateFeature(id: string, data: Partial<Pick<Feature, 'title' | 'description' | 'acceptance_criteria'>>): Promise<void>
  deleteFeature(id: string): Promise<void>
  reorderFeatures(items: { id: string; order: number }[]): void

  /* ---- epic CRUD ---- */
  createEpic(epic: Epic): Promise<void>
  updateEpic(id: string, data: Partial<Pick<Epic, 'title' | 'description' | 'acceptance_criteria'>>): Promise<void>
  deleteEpic(id: string): Promise<void>
  reorderEpics(items: { id: string; order: number }[]): void
  moveEpic(epicId: string, targetFeatureId: string, newOrder: number): Promise<void>

  /* ---- story CRUD ---- */
  createStory(story: Story): Promise<void>
  updateStory(id: string, data: Partial<Pick<Story, 'title' | 'description' | 'acceptance_criteria' | 'release_id'>>): Promise<void>
  deleteStory(id: string): Promise<void>
  reorderStories(items: { id: string; order: number }[]): void
  moveStory(storyId: string, targetEpicId: string, releaseId: string | null, newOrder: number): Promise<void>

  /* ---- release CRUD ---- */
  createRelease(release: Release): Promise<void>
  updateRelease(id: string, data: Partial<Pick<Release, 'name' | 'colour'>>): Promise<void>
  deleteRelease(id: string): Promise<void>
  reorderReleases(items: { id: string; order: number }[]): void

  /* ---- promotion ---- */
  promoteStoryToEpic(storyId: string, epic: Epic): Promise<void>
}
