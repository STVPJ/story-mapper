import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { ColourPicker } from '../shared/ColourPicker'
import { Button } from '../shared/Button'
import type { Release } from '../../types'

interface SortableReleaseItemProps {
  release: Release
  editingColour: string | null
  setEditingColour: (id: string | null) => void
  updateRelease: (id: string, data: Partial<Pick<Release, 'name' | 'colour'>>) => Promise<void>
  deleteRelease: (id: string) => Promise<void>
}

function SortableReleaseItem({
  release,
  editingColour,
  setEditingColour,
  updateRelease,
  deleteRelease,
}: SortableReleaseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: release.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-gray-700 rounded-lg p-3 space-y-2 bg-gray-800 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical size={14} className="text-gray-600" />
        </div>
        <div
          className="w-4 h-4 rounded-full shrink-0 cursor-pointer"
          style={{ backgroundColor: release.colour }}
          onClick={() =>
            setEditingColour(editingColour === release.id ? null : release.id)
          }
        />
        <input
          value={release.name}
          onChange={(e) => updateRelease(release.id, { name: e.target.value })}
          onBlur={(e) => updateRelease(release.id, { name: e.target.value })}
          maxLength={200}
          className="flex-1 px-2 py-1 text-sm text-gray-200 bg-transparent border border-transparent hover:border-gray-600 focus:border-gray-500 rounded focus:outline-none"
        />
        <button
          onClick={() => {
            if (confirm('Delete this release? Stories will become unassigned.')) {
              deleteRelease(release.id)
            }
          }}
          className="p-1 hover:bg-red-900/30 rounded text-gray-500 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {editingColour === release.id && (
        <div className="pl-6">
          <ColourPicker
            value={release.colour}
            onChange={(colour) => {
              updateRelease(release.id, { colour })
              setEditingColour(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

interface ReleaseManagerProps {
  storyMapId: string
  onClose: () => void
}

export function ReleaseManager({ storyMapId, onClose }: ReleaseManagerProps) {
  const { addRelease, updateRelease, deleteRelease, reorderReleases } = useStoryMapStore()
  const map = useStoryMapStore((s) => s.storyMaps.find((m) => m.id === storyMapId))
  const releases = map?.releases || []
  const [editingColour, setEditingColour] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = releases.findIndex((r) => r.id === active.id)
    const newIndex = releases.findIndex((r) => r.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderReleases(storyMapId, arrayMove(releases, oldIndex, newIndex))
    }
  }

  const releaseIds = releases.map((r) => r.id)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="bg-gray-900 w-full max-w-md h-full shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Manage Releases</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {releases.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No releases yet. Create one to start organising stories.
            </p>
          )}

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={releaseIds} strategy={verticalListSortingStrategy}>
              {releases.map((release) => (
                <SortableReleaseItem
                  key={release.id}
                  release={release}
                  editingColour={editingColour}
                  setEditingColour={setEditingColour}
                  updateRelease={updateRelease}
                  deleteRelease={deleteRelease}
                />
              ))}
            </SortableContext>
          </DndContext>

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => addRelease(storyMapId)}
          >
            <Plus size={14} /> Add Release
          </Button>
        </div>
      </div>
    </div>
  )
}
