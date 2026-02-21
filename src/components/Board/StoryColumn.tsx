import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { StoryCard } from '../Cards/StoryCard'
import { ReleaseDivider } from './ReleaseDivider'
import type { Epic, Release, Story, CardType } from '../../types'

interface StoryColumnProps {
  epic: Epic
  releases: Release[]
  onCardClick: (id: string, type: CardType) => void
  onAddStory: (epicId: string, releaseId?: string | null) => void
}

export function StoryColumn({ epic, releases, onCardClick, onAddStory }: StoryColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `story-column-${epic.id}`,
    data: { type: 'story-column', epicId: epic.id },
  })

  // Group stories by release
  const groupedStories: { release: Release | null; label: string; stories: Story[] }[] = []

  for (const release of releases) {
    groupedStories.push({
      release,
      label: release.name,
      stories: epic.stories.filter((s) => s.release_id === release.id),
    })
  }

  // Unassigned stories
  const unassigned = epic.stories.filter(
    (s) => !s.release_id || !releases.find((r) => r.id === s.release_id)
  )
  groupedStories.push({ release: null, label: 'Unassigned', stories: unassigned })

  const allStoryIds = epic.stories.map((s) => s.id)

  return (
    <div ref={setNodeRef} className="w-[220px] min-h-[100px] space-y-1">
      <SortableContext items={allStoryIds} strategy={verticalListSortingStrategy}>
        {releases.length > 0
          ? groupedStories.map((group) => (
              <div key={group.release?.id || 'unassigned'}>
                <ReleaseDivider release={group.release} label={group.label} />
                <div className="space-y-1.5 min-h-[8px]">
                  {group.stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      releases={releases}
                      onClick={() => onCardClick(story.id, 'story')}
                    />
                  ))}
                </div>
              </div>
            ))
          : epic.stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                releases={releases}
                onClick={() => onCardClick(story.id, 'story')}
              />
            ))}
      </SortableContext>

      <button
        onClick={() => onAddStory(epic.id)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors w-full"
      >
        <Plus size={12} /> Add Story
      </button>
    </div>
  )
}
