import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Tag,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { UserMenu } from '../Auth/UserMenu'
import { Button } from '../shared/Button'
import { supabase } from '../../lib/supabase'
import { importSchema } from '../../schemas/importSchema'

interface ToolbarProps {
  onManageReleases: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
}

export function Toolbar({ onManageReleases, zoom, onZoomIn, onZoomOut, onFitToScreen }: ToolbarProps) {
  const { setCurrentMap, updateStoryMapName, getCurrentMap, fetchStoryMaps, setError } = useStoryMapStore()
  const map = getCurrentMap()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(map?.name || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      const result = importSchema.safeParse(parsed)
      if (!result.success) {
        const issue = result.error.issues[0]
        setError(`Invalid import: ${issue.path.join('.')} - ${issue.message}`)
        return
      }

      const imported = result.data

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setError('Not authenticated. Please sign in again.')
        return
      }
      const userId = userData.user.id

      // Create new map
      const { data: newMap, error: mapError } = await supabase
        .from('story_maps')
        .insert({ name: `${imported.name} (imported)`, user_id: userId })
        .select()
        .single()
      if (mapError || !newMap) throw new Error(mapError?.message || 'Failed to create map')

      // Import releases
      const releaseIdMap = new Map<string, string>()
      for (const release of imported.releases) {
        const { data } = await supabase
          .from('releases')
          .insert({
            story_map_id: newMap.id,
            user_id: userId,
            name: release.name,
            order: release.order,
            colour: release.colour,
          })
          .select()
          .single()
        if (data) releaseIdMap.set(release.id, data.id)
      }

      // Import features → epics → stories
      for (const feature of imported.features) {
        const { data: newFeature } = await supabase
          .from('features')
          .insert({
            story_map_id: newMap.id,
            user_id: userId,
            title: feature.title,
            description: feature.description,
            acceptance_criteria: feature.acceptance_criteria,
            order: feature.order,
          })
          .select()
          .single()
        if (!newFeature) continue

        for (const epic of feature.epics) {
          const { data: newEpic } = await supabase
            .from('epics')
            .insert({
              feature_id: newFeature.id,
              user_id: userId,
              title: epic.title,
              description: epic.description,
              acceptance_criteria: epic.acceptance_criteria,
              order: epic.order,
            })
            .select()
            .single()
          if (!newEpic) continue

          for (const story of epic.stories) {
            await supabase.from('stories').insert({
              epic_id: newEpic.id,
              user_id: userId,
              release_id: story.release_id ? releaseIdMap.get(story.release_id) || null : null,
              title: story.title,
              description: story.description,
              acceptance_criteria: story.acceptance_criteria,
              order: story.order,
            })
          }
        }
      }

      await fetchStoryMaps()
    } catch (err: any) {
      setError(err.message || 'Failed to import file')
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
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

      <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
        <Upload size={14} /> Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

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
