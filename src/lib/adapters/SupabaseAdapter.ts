/**
 * Supabase storage adapter.
 *
 * Preserves the original cloud-backed persistence behaviour. Enable it
 * by setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { StorageAdapter } from './StorageAdapter'
import type { StoryMap, Feature, Epic, Story, Release } from '../../types'

const reorderTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function debouncedReorder(supabase: SupabaseClient, table: string, items: { id: string; order: number }[]) {
  const existing = reorderTimeouts.get(table)
  if (existing) clearTimeout(existing)
  reorderTimeouts.set(
    table,
    setTimeout(async () => {
      reorderTimeouts.delete(table)
      const promises = items.map((item) =>
        supabase.from(table).update({ order: item.order }).eq('id', item.id)
      )
      const results = await Promise.all(promises)
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        console.error(`Reorder sync failed for ${table}:`, failed.error)
      }
    }, 300)
  )
}

export class SupabaseAdapter implements StorageAdapter {
  private supabase: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.supabase = createClient(url, anonKey)
  }

  /** Expose the Supabase client for auth operations. */
  get client(): SupabaseClient {
    return this.supabase
  }

  private async getUserId(): Promise<string> {
    const { data } = await this.supabase.auth.getUser()
    if (!data.user) throw new Error('Not authenticated. Please sign in again.')
    return data.user.id
  }

  async init(): Promise<StoryMap[]> {
    const { data, error } = await this.supabase
      .from('story_maps')
      .select('*, features(*, epics(*, stories(*))), releases(*)')
      .order('updated_at', { ascending: false })

    if (error) throw new Error(error.message)

    return (data || []).map((m: StoryMap) => ({
      ...m,
      features: (m.features || [])
        .sort((a: Feature, b: Feature) => a.order - b.order)
        .map((f: Feature) => ({
          ...f,
          epics: (f.epics || [])
            .sort((a: Epic, b: Epic) => a.order - b.order)
            .map((e: Epic) => ({
              ...e,
              stories: (e.stories || []).sort((a: Story, b: Story) => a.order - b.order),
            })),
        })),
      releases: (m.releases || []).sort((a: Release, b: Release) => a.order - b.order),
    }))
  }

  /* ---- story map CRUD ---- */

  async createMap(map: StoryMap): Promise<void> {
    const userId = await this.getUserId()
    const { error } = await this.supabase
      .from('story_maps')
      .insert({ id: map.id, name: map.name, user_id: userId })
    if (error) throw new Error(error.message)
  }

  async updateMap(id: string, data: Partial<Pick<StoryMap, 'name'>>): Promise<void> {
    const { error } = await this.supabase.from('story_maps').update(data).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteMap(id: string): Promise<void> {
    const { error } = await this.supabase.from('story_maps').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  /* ---- feature CRUD ---- */

  async createFeature(feature: Feature): Promise<void> {
    const userId = await this.getUserId()
    const { error } = await this.supabase.from('features').insert({
      id: feature.id,
      story_map_id: feature.story_map_id,
      user_id: userId,
      title: feature.title,
      description: feature.description,
      acceptance_criteria: feature.acceptance_criteria,
      order: feature.order,
    })
    if (error) throw new Error(error.message)
  }

  async updateFeature(id: string, data: Partial<Pick<Feature, 'title' | 'description' | 'acceptance_criteria'>>): Promise<void> {
    const { error } = await this.supabase.from('features').update(data).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteFeature(id: string): Promise<void> {
    const { error } = await this.supabase.from('features').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  reorderFeatures(items: { id: string; order: number }[]): void {
    debouncedReorder(this.supabase, 'features', items)
  }

  /* ---- epic CRUD ---- */

  async createEpic(epic: Epic): Promise<void> {
    const userId = await this.getUserId()
    const { error } = await this.supabase.from('epics').insert({
      id: epic.id,
      feature_id: epic.feature_id,
      user_id: userId,
      title: epic.title,
      description: epic.description,
      acceptance_criteria: epic.acceptance_criteria,
      order: epic.order,
    })
    if (error) throw new Error(error.message)
  }

  async updateEpic(id: string, data: Partial<Pick<Epic, 'title' | 'description' | 'acceptance_criteria'>>): Promise<void> {
    const { error } = await this.supabase.from('epics').update(data).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteEpic(id: string): Promise<void> {
    const { error } = await this.supabase.from('epics').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  reorderEpics(items: { id: string; order: number }[]): void {
    debouncedReorder(this.supabase, 'epics', items)
  }

  async moveEpic(epicId: string, targetFeatureId: string, newOrder: number): Promise<void> {
    const { error } = await this.supabase
      .from('epics')
      .update({ feature_id: targetFeatureId, order: newOrder })
      .eq('id', epicId)
    if (error) throw new Error(error.message)
  }

  /* ---- story CRUD ---- */

  async createStory(story: Story): Promise<void> {
    const userId = await this.getUserId()
    const { error } = await this.supabase.from('stories').insert({
      id: story.id,
      epic_id: story.epic_id,
      user_id: userId,
      release_id: story.release_id,
      title: story.title,
      description: story.description,
      acceptance_criteria: story.acceptance_criteria,
      order: story.order,
    })
    if (error) throw new Error(error.message)
  }

  async updateStory(id: string, data: Partial<Pick<Story, 'title' | 'description' | 'acceptance_criteria' | 'release_id'>>): Promise<void> {
    const { error } = await this.supabase.from('stories').update(data).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteStory(id: string): Promise<void> {
    const { error } = await this.supabase.from('stories').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  reorderStories(items: { id: string; order: number }[]): void {
    debouncedReorder(this.supabase, 'stories', items)
  }

  async moveStory(storyId: string, targetEpicId: string, releaseId: string | null, newOrder: number): Promise<void> {
    const { error } = await this.supabase
      .from('stories')
      .update({ epic_id: targetEpicId, release_id: releaseId, order: newOrder })
      .eq('id', storyId)
    if (error) throw new Error(error.message)
  }

  /* ---- release CRUD ---- */

  async createRelease(release: Release): Promise<void> {
    const userId = await this.getUserId()
    const { error } = await this.supabase.from('releases').insert({
      id: release.id,
      story_map_id: release.story_map_id,
      user_id: userId,
      name: release.name,
      order: release.order,
      colour: release.colour,
    })
    if (error) throw new Error(error.message)
  }

  async updateRelease(id: string, data: Partial<Pick<Release, 'name' | 'colour'>>): Promise<void> {
    const { error } = await this.supabase.from('releases').update(data).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteRelease(id: string): Promise<void> {
    const { error } = await this.supabase.from('releases').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  reorderReleases(items: { id: string; order: number }[]): void {
    debouncedReorder(this.supabase, 'releases', items)
  }

  /* ---- promotion ---- */

  async promoteStoryToEpic(storyId: string, epic: Epic): Promise<void> {
    const userId = await this.getUserId()

    const { error: deleteError } = await this.supabase.from('stories').delete().eq('id', storyId)
    if (deleteError) throw new Error(deleteError.message)

    const { error: insertError } = await this.supabase.from('epics').insert({
      id: epic.id,
      feature_id: epic.feature_id,
      user_id: userId,
      title: epic.title,
      description: epic.description,
      acceptance_criteria: epic.acceptance_criteria,
      order: epic.order,
    })
    if (insertError) throw new Error(insertError.message)
  }
}
