import { z } from 'zod'

const storySchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  order: z.number(),
  release_id: z.string().nullable().optional(),
})

const epicSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  order: z.number(),
  stories: z.array(storySchema).max(200).default([]),
})

const featureSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  order: z.number(),
  epics: z.array(epicSchema).max(50).default([]),
})

const releaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour (e.g. #FF0000)'),
})

export const importSchema = z.object({
  name: z.string(),
  features: z.array(featureSchema).max(100),
  releases: z.array(releaseSchema).default([]),
})

export type ImportData = z.infer<typeof importSchema>
