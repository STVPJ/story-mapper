import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { Toolbar } from '../Toolbar/Toolbar'
import { FeatureRow } from './FeatureRow'
import { EpicRow } from './EpicRow'
import { CardModal } from '../Modal/CardModal'
import { ReleaseManager } from '../Modal/ReleaseManager'
import type { CardType, Feature, Epic, Story } from '../../types'

interface ModalState {
  id: string
  type: CardType
  title: string
  description: string
  acceptance_criteria: string
  release_id?: string | null
}

export function Board() {
  const store = useStoryMapStore()
  const map = store.getCurrentMap()

  const [modal, setModal] = useState<ModalState | null>(null)
  const [showReleases, setShowReleases] = useState(false)
  const [zoom, setZoom] = useState(1)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleCardClick = useCallback(
    (id: string, type: CardType) => {
      if (!map) return
      let card: { title: string; description: string; acceptance_criteria: string; release_id?: string | null } | undefined

      if (type === 'feature') {
        card = map.features.find((f) => f.id === id)
      } else if (type === 'epic') {
        for (const f of map.features) {
          const epic = f.epics.find((e) => e.id === id)
          if (epic) { card = epic; break }
        }
      } else {
        for (const f of map.features) {
          for (const e of f.epics) {
            const story = e.stories.find((s) => s.id === id)
            if (story) { card = story; break }
          }
        }
      }

      if (card) {
        setModal({ id, type, ...card })
      }
    },
    [map]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!map) return
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeData = active.data.current as { type: string; item: any } | undefined
      const overData = over.data.current as { type: string; item?: any; epicId?: string } | undefined
      if (!activeData) return

      if (activeData.type === 'feature') {
        const oldIndex = map.features.findIndex((f) => f.id === active.id)
        const newIndex = map.features.findIndex((f) => f.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(map.features, oldIndex, newIndex)
          store.reorderFeatures(map.id, reordered)
        }
      } else if (activeData.type === 'epic') {
        const activeEpic = activeData.item as Epic

        if (overData?.type === 'epic') {
          const overEpic = overData.item as Epic
          const sourceFeature = map.features.find((f) => f.id === activeEpic.feature_id)
          const targetFeature = map.features.find((f) => f.id === overEpic.feature_id)

          if (sourceFeature && targetFeature) {
            if (sourceFeature.id === targetFeature.id) {
              const oldIndex = sourceFeature.epics.findIndex((e) => e.id === active.id)
              const newIndex = sourceFeature.epics.findIndex((e) => e.id === over.id)
              if (oldIndex !== -1 && newIndex !== -1) {
                const reordered = arrayMove(sourceFeature.epics, oldIndex, newIndex)
                store.reorderEpics(sourceFeature.id, reordered)
              }
            } else {
              const newIndex = targetFeature.epics.findIndex((e) => e.id === over.id)
              store.moveEpic(activeEpic.id, targetFeature.id, Math.max(newIndex, 0))
            }
          }
        }
      } else if (activeData.type === 'story') {
        const activeStory = activeData.item as Story

        if (overData?.type === 'story') {
          const overStory = overData.item as Story
          let sourceEpic: Epic | undefined
          let targetEpic: Epic | undefined

          for (const f of map.features) {
            for (const e of f.epics) {
              if (e.stories.some((s) => s.id === activeStory.id)) sourceEpic = e
              if (e.stories.some((s) => s.id === overStory.id)) targetEpic = e
            }
          }

          if (sourceEpic && targetEpic) {
            if (sourceEpic.id === targetEpic.id) {
              const oldIndex = sourceEpic.stories.findIndex((s) => s.id === active.id)
              const newIndex = sourceEpic.stories.findIndex((s) => s.id === over.id)
              if (oldIndex !== -1 && newIndex !== -1) {
                const reordered = arrayMove(sourceEpic.stories, oldIndex, newIndex)
                store.reorderStories(sourceEpic.id, reordered)
              }
            } else {
              const newIndex = targetEpic.stories.findIndex((s) => s.id === over.id)
              store.moveStory(
                activeStory.id,
                targetEpic.id,
                overStory.release_id,
                Math.max(newIndex, 0)
              )
            }
          }
        } else if (overData?.type === 'story-column') {
          const targetEpicId = overData.epicId!
          if (targetEpicId !== activeStory.epic_id) {
            store.moveStory(activeStory.id, targetEpicId, activeStory.release_id, 0)
          }
        }
      }
    },
    [map, store]
  )

  const handleAddFeature = useCallback(async () => {
    if (!map) return
    const id = await store.addFeature(map.id)
    if (id) handleCardClick(id, 'feature')
  }, [map, store, handleCardClick])

  const handleAddEpic = useCallback(
    async (featureId: string) => {
      const id = await store.addEpic(featureId)
      if (id) handleCardClick(id, 'epic')
    },
    [store, handleCardClick]
  )

  const handleAddStory = useCallback(
    async (epicId: string, releaseId?: string | null) => {
      const id = await store.addStory(epicId, releaseId)
      if (id) handleCardClick(id, 'story')
    },
    [store, handleCardClick]
  )

  if (!map) return null

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Toolbar
        onManageReleases={() => setShowReleases(true)}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(z + 0.1, 2))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.1, 0.3))}
        onFitToScreen={() => setZoom(1)}
      />

      <div className="flex-1 overflow-auto p-6">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="space-y-4 inline-block"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {/* Feature Row */}
            <FeatureRow
              features={map.features}
              onCardClick={handleCardClick}
              onAddFeature={handleAddFeature}
            />

            {/* Epic Rows + Story Columns per Feature */}
            <div className="flex gap-3">
              {map.features.map((feature) => (
                <EpicRow
                  key={feature.id}
                  feature={feature}
                  releases={map.releases}
                  onCardClick={handleCardClick}
                  onAddEpic={handleAddEpic}
                  onAddStory={handleAddStory}
                />
              ))}
            </div>
          </DndContext>

          {map.features.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p>Add your first feature to start mapping</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <CardModal
          id={modal.id}
          type={modal.type}
          title={modal.title}
          description={modal.description}
          acceptance_criteria={modal.acceptance_criteria}
          release_id={modal.release_id}
          releases={map.releases}
          onClose={() => setModal(null)}
        />
      )}

      {showReleases && (
        <ReleaseManager storyMapId={map.id} onClose={() => setShowReleases(false)} />
      )}
    </div>
  )
}
