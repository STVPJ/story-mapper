/**
 * Validates a full StoryMap as persisted to a JSON file on disk (FSA
 * mode). Unlike `importSchema` (which accepts a loose external file and
 * re-mints ids), this preserves the real ids, user_id, relational id
 * fields and timestamps so files round-trip with stable identity.
 *
 * Field-length limits mirror `importSchema` for consistency. Optional
 * text fields default so an older/hand-edited file still loads.
 */
import { z } from 'zod'
import type { StoryMap } from '../types'

const id = z.string().max(100)
const text = z.string().max(10000).default('')
const title = z.string().max(500)
const isoDate = z.string().max(40)

const storySchema = z.object({
  id,
  user_id: id,
  epic_id: id,
  release_id: z.string().max(100).nullable().default(null),
  title,
  description: text,
  acceptance_criteria: text,
  order: z.number(),
})

const epicSchema = z.object({
  id,
  user_id: id,
  feature_id: id,
  title,
  description: text,
  acceptance_criteria: text,
  order: z.number(),
  stories: z.array(storySchema).max(200).default([]),
})

const featureSchema = z.object({
  id,
  user_id: id,
  story_map_id: id,
  title,
  description: text,
  acceptance_criteria: text,
  order: z.number(),
  epics: z.array(epicSchema).max(50).default([]),
})

const releaseSchema = z.object({
  id,
  user_id: id,
  story_map_id: id,
  name: z.string().max(200),
  order: z.number(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour'),
})

export const storedMapSchema = z.object({
  id,
  user_id: id,
  name: z.string().max(200),
  created_at: isoDate,
  updated_at: isoDate,
  features: z.array(featureSchema).max(100).default([]),
  releases: z.array(releaseSchema).max(200).default([]),
})

/** Parse + validate; returns the map or null if the file is not a valid map. */
export function parseStoredMap(raw: unknown): StoryMap | null {
  const result = storedMapSchema.safeParse(raw)
  return result.success ? (result.data as StoryMap) : null
}
