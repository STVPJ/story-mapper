import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, ArrowUpCircle } from 'lucide-react'
import { EpicCard } from '../Cards/EpicCard'
import type { Feature, CardType } from '../../types'

interface EpicRowProps {
  feature: Feature
  onCardClick: (id: string, type: CardType) => void
  onAddEpic: (featureId: string) => void
  activeDragType: CardType | null
  zoom?: number
  overTargetId?: string | null
  activeDragId?: string | null
}

function EpicPromotionZone({ featureId, isStoryDragging }: { featureId: string; isStoryDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `epic-promotion-${featureId}`,
    data: { type: 'epic-promotion', featureId },
    disabled: !isStoryDragging,
  })

  if (!isStoryDragging) return null

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-xs font-medium transition-colors self-start whitespace-nowrap h-fit ${
        isOver
          ? 'border-teal-400 bg-teal-900/30 text-teal-300'
          : 'border-gray-600 bg-gray-800 text-gray-500'
      }`}
    >
      <ArrowUpCircle size={14} />
      Promote to Epic
    </div>
  )
}

export function EpicRow({ feature, onCardClick, onAddEpic, activeDragType, zoom = 1, overTargetId, activeDragId }: EpicRowProps) {
  const epicIds = feature.epics.map((e) => e.id)

  return (
    <div className="bg-indigo-950/30 rounded-lg border border-indigo-900/50 p-2">
      <div className="flex gap-3">
        <SortableContext items={epicIds} strategy={horizontalListSortingStrategy}>
          {feature.epics.map((epic) => (
            <EpicCard
              key={epic.id}
              epic={epic}
              zoom={zoom}
              isDropTarget={activeDragType === 'epic' && overTargetId === epic.id && activeDragId !== epic.id}
              onClick={() => onCardClick(epic.id, 'epic')}
            />
          ))}
        </SortableContext>
      </div>
      <div className="flex gap-2 mt-1.5">
        <EpicPromotionZone featureId={feature.id} isStoryDragging={activeDragType === 'story'} />
        <button
          onClick={() => onAddEpic(feature.id)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={12} /> Add Epic
        </button>
      </div>
    </div>
  )
}
