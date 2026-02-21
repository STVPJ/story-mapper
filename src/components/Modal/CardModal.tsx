import { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { Button } from '../shared/Button'
import type { CardType, Release } from '../../types'

interface CardModalProps {
  id: string
  type: CardType
  title: string
  description: string
  acceptance_criteria: string
  release_id?: string | null
  releases?: Release[]
  onClose: () => void
}

const badgeStyles: Record<CardType, string> = {
  feature: 'bg-[#312E81] text-white',
  epic: 'bg-[#0891B2] text-white',
  story: 'bg-gray-100 text-gray-700',
}

export function CardModal({
  id,
  type,
  title: initialTitle,
  description: initialDescription,
  acceptance_criteria: initialAC,
  release_id,
  releases = [],
  onClose,
}: CardModalProps) {
  const { updateFeature, updateEpic, updateStory, deleteFeature, deleteEpic, deleteStory } =
    useStoryMapStore()

  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [ac, setAC] = useState(initialAC)
  const [selectedRelease, setSelectedRelease] = useState(release_id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const save = (field: string, value: string) => {
    const data = { [field]: value }
    if (type === 'feature') updateFeature(id, data)
    else if (type === 'epic') updateEpic(id, data)
    else updateStory(id, data)
  }

  const handleReleaseChange = (releaseId: string) => {
    const val = releaseId === '' ? null : releaseId
    setSelectedRelease(val)
    updateStory(id, { release_id: val })
  }

  const handleDelete = () => {
    if (type === 'feature') deleteFeature(id)
    else if (type === 'epic') deleteEpic(id)
    else deleteStory(id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${badgeStyles[type]}`}>
            {type}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => save('title', title)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save('description', description)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              placeholder="Describe this item..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acceptance Criteria
            </label>
            <textarea
              value={ac}
              onChange={(e) => setAC(e.target.value)}
              onBlur={() => save('acceptance_criteria', ac)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              placeholder="Define acceptance criteria..."
            />
          </div>

          {type === 'story' && releases.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Release</label>
              <select
                value={selectedRelease || ''}
                onChange={(e) => handleReleaseChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Are you sure? This will delete all child items.
              </span>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                Delete
              </Button>
              <Button size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
