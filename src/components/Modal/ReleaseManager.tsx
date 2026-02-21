import { useState } from 'react'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { ColourPicker } from '../shared/ColourPicker'
import { Button } from '../shared/Button'

interface ReleaseManagerProps {
  storyMapId: string
  onClose: () => void
}

export function ReleaseManager({ storyMapId, onClose }: ReleaseManagerProps) {
  const { addRelease, updateRelease, deleteRelease } = useStoryMapStore()
  const map = useStoryMapStore((s) => s.storyMaps.find((m) => m.id === storyMapId))
  const releases = map?.releases || []
  const [editingColour, setEditingColour] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Manage Releases</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {releases.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No releases yet. Create one to start organising stories.
            </p>
          )}

          {releases.map((release) => (
            <div key={release.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300 shrink-0" />
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
                  className="flex-1 px-2 py-1 text-sm border border-transparent hover:border-gray-200 focus:border-gray-300 rounded focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (confirm('Delete this release? Stories will become unassigned.')) {
                      deleteRelease(release.id)
                    }
                  }}
                  className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
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
          ))}

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
