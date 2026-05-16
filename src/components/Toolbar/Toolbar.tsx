import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Tag,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronDown,
} from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { UserMenu } from '../Auth/UserMenu'
import { Button } from '../shared/Button'
import { exportToJira } from '../../lib/exporters/jira'
import { exportToADO } from '../../lib/exporters/ado'
import { downloadFile } from '../../lib/exporters/csv'

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
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExportJson = () => {
    if (!map) return
    const data = JSON.stringify(map, null, 2)
    const filename = `${map.name.replace(/\s+/g, '_').toLowerCase()}.json`
    downloadFile(data, filename, 'application/json')
    setExportOpen(false)
  }

  const handleExportJira = () => {
    if (!map) return
    exportToJira(map)
    setExportOpen(false)
  }

  const handleExportADO = () => {
    if (!map) return
    exportToADO(map)
    setExportOpen(false)
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

      {/* Export dropdown */}
      <div ref={exportRef} className="relative">
        <Button size="sm" variant="ghost" onClick={() => setExportOpen(!exportOpen)}>
          <Download size={14} /> Export <ChevronDown size={12} />
        </Button>
        {exportOpen && (
          <div className="absolute right-0 mt-1 w-52 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
            <button
              onClick={handleExportJson}
              className="flex flex-col w-full px-4 py-2 text-left hover:bg-gray-700"
            >
              <span className="text-sm text-gray-200">JSON</span>
              <span className="text-xs text-gray-500">Full map data, re-importable</span>
            </button>
            <button
              onClick={handleExportJira}
              className="flex flex-col w-full px-4 py-2 text-left hover:bg-gray-700"
            >
              <span className="text-sm text-gray-200">Jira CSV</span>
              <span className="text-xs text-gray-500">Epics, Stories, Sub-tasks</span>
            </button>
            <button
              onClick={handleExportADO}
              className="flex flex-col w-full px-4 py-2 text-left hover:bg-gray-700"
            >
              <span className="text-sm text-gray-200">Azure DevOps CSV</span>
              <span className="text-xs text-gray-500">Epics, Features, User Stories</span>
            </button>
          </div>
        )}
      </div>

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
