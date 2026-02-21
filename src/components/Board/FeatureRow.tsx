import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { FeatureCard } from '../Cards/FeatureCard'
import type { Feature, CardType } from '../../types'

interface FeatureRowProps {
  features: Feature[]
  onCardClick: (id: string, type: CardType) => void
  onAddFeature: () => void
}

export function FeatureRow({ features, onCardClick, onAddFeature }: FeatureRowProps) {
  const featureIds = features.map((f) => f.id)

  return (
    <div className="flex gap-3 items-start">
      <SortableContext items={featureIds} strategy={horizontalListSortingStrategy}>
        {features.map((feature) => (
          <div
            key={feature.id}
            style={{ width: `${Math.max(feature.epics.length, 1) * 232}px` }}
          >
            <FeatureCard
              feature={feature}
              onClick={() => onCardClick(feature.id, 'feature')}
            />
          </div>
        ))}
      </SortableContext>

      <button
        onClick={onAddFeature}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap border-2 border-dashed border-gray-200 hover:border-gray-300"
      >
        <Plus size={14} /> Add Feature
      </button>
    </div>
  )
}
