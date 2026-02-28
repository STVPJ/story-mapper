import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { StoryCard } from '../Cards/StoryCard'
import { ReleaseDivider } from './ReleaseDivider'
import type { Epic, Release, Story, CardType } from '../../types'

interface ReleaseSectionProps {
  epicId: string
  releaseId: string | null
  stories: Story[]
  releases: Release[]
  onCardClick: (id: string, type: CardType) => void
  isStoryDragging: boolean
}

function ReleaseSection({ epicId, releaseId, stories, releases, onCardClick, isStoryDragging }: ReleaseSectionProps) {
  const droppableId = `release-section-${epicId}-${releaseId ?? 'unassigned'}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'release-section', epicId, releaseId: releaseId ?? null },
    disabled: !isStoryDragging,
  })

  return (
    <div
      ref={setNodeRef}
      className={`space-y-1.5 min-h-[8px] rounded-md transition-colors px-1 py-0.5 ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''
      }`}
    >
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          releases={releases}
          onClick={() => onCardClick(story.id, 'story')}
        />
      ))}
    </div>
  )
}

interface StoryColumnProps {
  epic: Epic
  releases: Release[]
  onCardClick: (id: string, type: CardType) => void
  onAddStory: (epicId: string, releaseId?: string | null) => void
  activeDragType: CardType | null
}

export function StoryColumn({ epic, releases, onCardClick, onAddStory, activeDragType }: StoryColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `story-column-${epic.id}`,
    data: { type: 'story-column', epicId: epic.id },
  })

  const isStoryDragging = activeDragType === 'story'

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
                <ReleaseSection
                  epicId={epic.id}
                  releaseId={group.release?.id ?? null}
                  stories={group.stories}
                  releases={releases}
                  onCardClick={onCardClick}
                  isStoryDragging={isStoryDragging}
                />
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
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 hover:bg-gray-800 rounded-lg transition-colors w-full"
      >
        <Plus size={12} /> Add Story
      </button>
    </div>
  )
}
