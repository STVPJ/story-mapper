import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Story, Release } from '../../types'

interface StoryCardProps {
  story: Story
  releases: Release[]
  onClick: () => void
}

export function StoryCard({ story, releases, onClick }: StoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
    data: { type: 'story', item: story },
  })

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  const release = releases.find((r) => r.id === story.release_id)
  const accentColour = release?.colour || '#4B5563'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-gray-800 text-gray-200 rounded-lg px-3 py-2.5 w-[220px] border border-gray-700 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
        isDragging ? 'opacity-50 shadow-xl' : ''
      }`}
      onClick={onClick}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: accentColour }}
      />
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="text-gray-500" />
      </div>
      <h4 className="text-[13px] font-medium line-clamp-2 pr-5">{story.title}</h4>
      {story.description && (
        <p className="text-[12px] text-gray-500 mt-1 truncate">{story.description}</p>
      )}
    </div>
  )
}
