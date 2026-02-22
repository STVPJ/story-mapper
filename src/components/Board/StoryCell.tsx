import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { StoryCard } from '../Cards/StoryCard'
import type { Story, Release, CardType } from '../../types'

interface StoryCellProps {
  epicId: string
  releaseId: string | null
  stories: Story[]
  releases: Release[]
  onCardClick: (id: string, type: CardType) => void
  onAddStory: (epicId: string, releaseId?: string | null) => void
  isStoryDragging: boolean
  zoom?: number
}

export function StoryCell({
  epicId,
  releaseId,
  stories,
  releases,
  onCardClick,
  onAddStory,
  isStoryDragging,
  zoom = 1,
}: StoryCellProps) {
  const droppableId = `release-section-${epicId}-${releaseId ?? 'unassigned'}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'release-section', epicId, releaseId },
  })

  const storyIds = stories.map((s) => s.id)

  return (
    <div
      ref={setNodeRef}
      className={`w-[220px] min-h-[32px] space-y-1.5 rounded-md transition-colors p-1 ${
        isOver && isStoryDragging ? 'bg-blue-900/30 ring-2 ring-blue-500' : ''
      }`}
    >
      <SortableContext items={storyIds} strategy={verticalListSortingStrategy}>
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            releases={releases}
            zoom={zoom}
            onClick={() => onCardClick(story.id, 'story')}
          />
        ))}
      </SortableContext>

      <button
        onClick={() => onAddStory(epicId, releaseId)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-2 py-1 hover:bg-gray-800 rounded transition-colors w-full opacity-0 hover:opacity-100 focus:opacity-100"
      >
        <Plus size={10} /> Add
      </button>
    </div>
  )
}
