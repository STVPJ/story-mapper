import { useEffect, useState, useRef } from 'react'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { Button } from '../shared/Button'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { PromptDialog } from '../shared/PromptDialog'
import { Plus, MoreHorizontal, Copy, Trash2, Pencil, Upload } from 'lucide-react'
import { UserMenu } from '../Auth/UserMenu'
import { supabase } from '../../lib/supabase'
import { importSchema } from '../../schemas/importSchema'

interface MapMenuProps {
  mapId: string
  onClose: () => void
  onRename: () => void
  onDelete: () => void
}

function MapMenu({ mapId, onClose, onRename, onDelete }: MapMenuProps) {
  const { duplicateStoryMap } = useStoryMapStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-8 w-44 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-10">
      <button
        onClick={() => {
          onClose()
          onRename()
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        <Pencil size={14} /> Rename
      </button>
      <button
        onClick={() => {
          duplicateStoryMap(mapId)
          onClose()
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        <Copy size={14} /> Duplicate
      </button>
      <button
        onClick={() => {
          onClose()
          onDelete()
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-900/30"
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  )
}

export function HomeScreen() {
  const { storyMaps, loading, fetchStoryMaps, createStoryMap, setCurrentMap, deleteStoryMap, updateStoryMapName, setError } = useStoryMapStore()
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [renamingMapId, setRenamingMapId] = useState<string | null>(null)
  const [deletingMapId, setDeletingMapId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStoryMaps()
  }, [fetchStoryMaps])

  const handleCreate = async () => {
    const name = newMapName.trim() || 'Untitled Map'
    setShowNameDialog(false)
    setNewMapName('')
    const id = await createStoryMap(name)
    if (id) setCurrentMap(id)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
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
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const renamingMap = renamingMapId ? storyMaps.find((m) => m.id === renamingMapId) : null
  const deletingMap = deletingMapId ? storyMaps.find((m) => m.id === deletingMapId) : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Name dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">New Story Map</h2>
            <input
              autoFocus
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Map name"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowNameDialog(false); setNewMapName('') }}
                className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <Button variant="primary" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {renamingMap && (
        <PromptDialog
          title="Rename Story Map"
          defaultValue={renamingMap.name}
          confirmLabel="Rename"
          onConfirm={(name) => {
            updateStoryMapName(renamingMap.id, name)
            setRenamingMapId(null)
          }}
          onCancel={() => setRenamingMapId(null)}
        />
      )}

      {/* Delete confirmation */}
      {deletingMap && (
        <ConfirmDialog
          title="Delete Story Map"
          message={`Delete "${deletingMap.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteStoryMap(deletingMap.id)
            setDeletingMapId(null)
          }}
          onCancel={() => setDeletingMapId(null)}
        />
      )}

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-100">Your Story Maps</h1>
          <div className="flex items-center gap-3">
            {storyMaps.length > 0 && (
              <>
                <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                  <Upload size={16} /> {importing ? 'Importing...' : 'Import'}
                </Button>
                <Button variant="primary" onClick={() => setShowNameDialog(true)}>
                  <Plus size={16} /> New Map
                </Button>
              </>
            )}
            <UserMenu />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>

        {storyMaps.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">Create your first story map to get started</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="primary" onClick={() => setShowNameDialog(true)}>
                <Plus size={16} /> Create Story Map
              </Button>
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Upload size={16} /> {importing ? 'Importing...' : 'Import JSON'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {storyMaps.map((map) => (
              <div
                key={map.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg border border-gray-700 px-5 py-4 hover:border-gray-600 transition-colors cursor-pointer group"
                onClick={() => setCurrentMap(map.id)}
              >
                <div>
                  <h3 className="font-medium text-gray-100">{map.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Last modified {new Date(map.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuOpen(menuOpen === map.id ? null : map.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal size={18} className="text-gray-500" />
                  </button>
                  {menuOpen === map.id && (
                    <MapMenu
                      mapId={map.id}
                      onClose={() => setMenuOpen(null)}
                      onRename={() => setRenamingMapId(map.id)}
                      onDelete={() => setDeletingMapId(map.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
