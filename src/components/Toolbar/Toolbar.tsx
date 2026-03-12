import { useState } from 'react'
import {
  ArrowLeft,
  Tag,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { UserMenu } from '../Auth/UserMenu'
import { Button } from '../shared/Button'

interface ToolbarProps {
  onManageReleases: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
}

export function Toolbar({ onManageReleases, zoom, onZoomIn, onZoomOut, onFitToScreen }: ToolbarProps) {
  const { setCurrentMap, updateStoryMapName, getCurrentMap } = useStoryMapStore()
  const map = getCurrentMap()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(map?.name || '')

  const handleExport = () => {
    if (!map) return
    const data = JSON.stringify(map, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${map.name.replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
      <button
        onClick={() => setCurrentMap(null)}
        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="Back to home"
      >
        <ArrowLeft size={18} className="text-gray-400" />
      </button>

      {editingName ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (map && name.trim()) updateStoryMapName(map.id, name.trim())
            setEditingName(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (map && name.trim()) updateStoryMapName(map.id, name.trim())
              setEditingName(false)
            }
          }}
          maxLength={200}
          className="text-lg font-semibold text-gray-100 bg-transparent border-b-2 border-indigo-500 outline-none px-1"
        />
      ) : (
        <button
          onClick={() => {
            setName(map?.name || '')
            setEditingName(true)
          }}
          className="text-lg font-semibold text-gray-100 hover:text-indigo-400 transition-colors"
        >
          {map?.name}
        </button>
      )}

      <div className="flex-1" />

      <Button size="sm" variant="ghost" onClick={onManageReleases}>
        <Tag size={14} /> Releases
      </Button>

      <Button size="sm" variant="ghost" onClick={handleExport}>
        <Download size={14} /> Export
      </Button>

      <div className="flex items-center gap-1 border-l border-gray-700 pl-3 ml-1">
        <button
          onClick={onZoomOut}
          className="p-1.5 hover:bg-gray-700 rounded-lg"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} className="text-gray-400" />
        </button>
        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={onZoomIn}
          className="p-1.5 hover:bg-gray-700 rounded-lg"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} className="text-gray-400" />
        </button>
        <button
          onClick={onFitToScreen}
          className="p-1.5 hover:bg-gray-700 rounded-lg"
          aria-label="Fit to screen"
        >
          <Maximize size={16} className="text-gray-400" />
        </button>
      </div>

      <div className="border-l border-gray-700 pl-3 ml-1">
        <UserMenu />
      </div>
    </div>
  )
}
