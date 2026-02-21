import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { EpicCard } from '../Cards/EpicCard'
import { StoryColumn } from './StoryColumn'
import type { Feature, Release, CardType } from '../../types'

interface EpicRowProps {
  feature: Feature
  releases: Release[]
  onCardClick: (id: string, type: CardType) => void
  onAddEpic: (featureId: string) => void
  onAddStory: (epicId: string, releaseId?: string | null) => void
}

export function EpicRow({ feature, releases, onCardClick, onAddEpic, onAddStory }: EpicRowProps) {
  const epicIds = feature.epics.map((e) => e.id)

  return (
    <div className="flex gap-3">
      <SortableContext items={epicIds} strategy={horizontalListSortingStrategy}>
        {feature.epics.map((epic) => (
          <div key={epic.id} className="flex flex-col gap-2">
            <EpicCard epic={epic} onClick={() => onCardClick(epic.id, 'epic')} />
            <StoryColumn
              epic={epic}
              releases={releases}
              onCardClick={onCardClick}
              onAddStory={onAddStory}
            />
          </div>
        ))}
      </SortableContext>

      <button
        onClick={() => onAddEpic(feature.id)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors self-start whitespace-nowrap h-fit"
      >
        <Plus size={12} /> Add Epic
      </button>
    </div>
  )
}
