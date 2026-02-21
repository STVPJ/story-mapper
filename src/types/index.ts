export interface StoryMap {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  features: Feature[]
  releases: Release[]
}

export interface Feature {
  id: string
  user_id: string
  story_map_id: string
  title: string
  description: string
  acceptance_criteria: string
  order: number
  epics: Epic[]
}

export interface Epic {
  id: string
  user_id: string
  feature_id: string
  title: string
  description: string
  acceptance_criteria: string
  order: number
  stories: Story[]
}

export interface Story {
  id: string
  user_id: string
  epic_id: string
  release_id: string | null
  title: string
  description: string
  acceptance_criteria: string
  order: number
}

export interface Release {
  id: string
  user_id: string
  story_map_id: string
  name: string
  order: number
  colour: string
}

export type CardType = 'feature' | 'epic' | 'story'

export interface CardData {
  id: string
  type: CardType
  title: string
  description: string
  acceptance_criteria: string
}
