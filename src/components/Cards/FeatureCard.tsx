import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Feature } from '../../types'

interface FeatureCardProps {
  feature: Feature
  onClick: () => void
}

export function FeatureCard({ feature, onClick }: FeatureCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
    data: { type: 'feature', item: feature },
  })

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-[#312E81] text-white rounded-lg px-4 py-3 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
        isDragging ? 'opacity-50 shadow-xl' : ''
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={16} className="text-indigo-300" />
      </div>
      <h3 className="font-bold text-base truncate pr-6">{feature.title}</h3>
    </div>
  )
}
