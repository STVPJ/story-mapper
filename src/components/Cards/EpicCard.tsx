import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Epic } from '../../types'

interface EpicCardProps {
  epic: Epic
  onClick: () => void
  zoom?: number
  isDropTarget?: boolean
}

export function EpicCard({ epic, onClick, zoom = 1, isDropTarget }: EpicCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: epic.id,
    data: { type: 'epic', item: epic },
  })

  const adjustedTransform = transform
    ? { ...transform, x: transform.x / zoom, y: transform.y / zoom }
    : null

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(adjustedTransform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-[#0891B2] text-white rounded-lg px-3 py-2.5 w-[220px] cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
        isDragging ? 'opacity-50 shadow-xl' : ''
      } ${
        isDropTarget && !isDragging ? 'ring-2 ring-cyan-300 shadow-lg shadow-cyan-500/20' : ''
      }`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="text-cyan-200" />
      </div>
      <h3 className="font-semibold text-sm line-clamp-2 pr-5">{epic.title}</h3>
    </div>
  )
}
