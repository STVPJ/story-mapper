import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useStoryMapStore } from '../../store/useStoryMapStore'
import { multiContainerCollisionDetection } from '../../utils/dnd'
import { Toolbar } from '../Toolbar/Toolbar'
import { FeatureCard } from '../Cards/FeatureCard'
import { EpicRow } from './EpicRow'
import { StoryCell } from './StoryCell'
import { ReleaseDivider } from './ReleaseDivider'
import { CardModal } from '../Modal/CardModal'
import { ReleaseManager } from '../Modal/ReleaseManager'
import { Plus } from 'lucide-react'
import type { CardType, Feature, Epic, Story, Release } from '../../types'

interface ModalState {
  id: string
  type: CardType
  title: string
  description: string
  acceptance_criteria: string
  release_id?: string | null
}

interface ActiveDrag {
  type: CardType
  item: Feature | Epic | Story
}

export function Board() {
  const store = useStoryMapStore()
  const map = store.getCurrentMap()

  const [modal, setModal] = useState<ModalState | null>(null)
  const [showReleases, setShowReleases] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [overTargetId, setOverTargetId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Build release groups: each release + unassigned
  const releaseGroups = useMemo(() => {
    if (!map) return []
    const groups: { release: Release | null; label: string; releaseId: string | null }[] = []
    for (const r of map.releases) {
      groups.push({ release: r, label: r.name, releaseId: r.id })
    }
    groups.push({ release: null, label: 'Unassigned', releaseId: null })
    return groups
  }, [map])

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { type: CardType; item: Feature | Epic | Story } | undefined
    if (data) {
      setActiveDrag({ type: data.type, item: data.item })
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverTargetId(event.over?.id as string ?? null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null)
      setOverTargetId(null)
      if (!map) return
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeData = active.data.current as { type: string; item: Feature | Epic | Story } | undefined
      const overData = over.data.current as { type: string; item?: Feature | Epic | Story; epicId?: string; releaseId?: string | null; featureId?: string } | undefined
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
        } else if (overData?.type === 'release-section') {
          const targetEpicId = overData.epicId!
          const targetReleaseId = overData.releaseId ?? null
          if (targetEpicId === activeStory.epic_id) {
            if (targetReleaseId !== activeStory.release_id) {
              store.updateStory(activeStory.id, { release_id: targetReleaseId })
            }
          } else {
            store.moveStory(activeStory.id, targetEpicId, targetReleaseId, 0)
          }
        } else if (overData?.type === 'epic-promotion') {
          const targetFeatureId = overData.featureId!
          const targetFeature = map.features.find((f) => f.id === targetFeatureId)
          const epicCount = targetFeature ? targetFeature.epics.length : 0
          store.promoteStoryToEpic(activeStory.id, targetFeatureId, epicCount)
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

  const activeDragType = activeDrag?.type ?? null
  const isStoryDragging = activeDragType === 'story'
  const hasReleases = map.releases.length > 0

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <Toolbar
        onManageReleases={() => setShowReleases(true)}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(z + 0.1, 2))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.1, 0.3))}
        onFitToScreen={() => setZoom(1)}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={multiContainerCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-auto p-6">
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="inline-block"
          >
            {/* ── Feature + Epic header ── */}
            <div className="flex gap-4 items-start">
              <SortableContext
                items={map.features.map((f) => f.id)}
                strategy={horizontalListSortingStrategy}
              >
                {map.features.map((feature) => (
                  <div key={feature.id} className="flex flex-col gap-2 min-w-[236px]">
                    <FeatureCard
                      feature={feature}
                      zoom={zoom}
                      isDropTarget={activeDragType === 'feature' && overTargetId === feature.id && activeDrag?.item.id !== feature.id}
                      onClick={() => handleCardClick(feature.id, 'feature')}
                    />
                    <EpicRow
                      feature={feature}
                      onCardClick={handleCardClick}
                      onAddEpic={handleAddEpic}
                      activeDragType={activeDragType}
                      zoom={zoom}
                      overTargetId={overTargetId}
                      activeDragId={activeDrag?.item.id}
                    />
                  </div>
                ))}
              </SortableContext>

              <button
                onClick={handleAddFeature}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 px-4 py-3 hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap border-2 border-dashed border-gray-700 hover:border-gray-600"
              >
                <Plus size={14} /> Add Feature
              </button>
            </div>

            {/* ── Release swim lanes ── */}
            {hasReleases ? (
              <div className="mt-4 space-y-1">
                {releaseGroups.map((group) => (
                  <div key={group.releaseId ?? 'unassigned'}>
                    <ReleaseDivider release={group.release} label={group.label} />
                    <div className="flex gap-4 items-start">
                      {map.features.map((feature) => (
                        <div
                          key={feature.id}
                          className="flex gap-3 min-w-[236px]"
                          style={{ paddingLeft: 8, paddingRight: 8 }}
                        >
                          {feature.epics.map((epic) => {
                            const stories = epic.stories.filter((s) =>
                              group.releaseId
                                ? s.release_id === group.releaseId
                                : !s.release_id || !map.releases.find((r) => r.id === s.release_id)
                            )
                            return (
                              <StoryCell
                                key={epic.id}
                                epicId={epic.id}
                                releaseId={group.releaseId}
                                stories={stories}
                                releases={map.releases}
                                onCardClick={handleCardClick}
                                onAddStory={handleAddStory}
                                isStoryDragging={isStoryDragging}
                                zoom={zoom}
                              />
                            )
                          })}
                          {feature.epics.length === 0 && (
                            <div className="w-[220px] min-h-[32px]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* No releases — show stories directly under epics */
              <div className="mt-4">
                <div className="flex gap-4 items-start">
                  {map.features.map((feature) => (
                    <div
                      key={feature.id}
                      className="flex gap-3 min-w-[236px]"
                      style={{ paddingLeft: 8, paddingRight: 8 }}
                    >
                      {feature.epics.map((epic) => (
                        <StoryCell
                          key={epic.id}
                          epicId={epic.id}
                          releaseId={null}
                          stories={epic.stories}
                          releases={map.releases}
                          onCardClick={handleCardClick}
                          onAddStory={handleAddStory}
                          isStoryDragging={isStoryDragging}
                          zoom={zoom}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {map.features.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                <p>Add your first feature to start mapping</p>
              </div>
            )}
          </div>
        </div>

        {/* DragOverlay — ghost card that follows cursor (outside scaled container) */}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.type === 'feature' && (
            <div className="bg-[#312E81] text-white rounded-lg px-4 py-3 shadow-xl opacity-90 min-w-[220px]">
              <h3 className="font-bold text-base truncate">{(activeDrag.item as Feature).title}</h3>
            </div>
          )}
          {activeDrag?.type === 'epic' && (
            <div className="bg-[#0891B2] text-white rounded-lg px-3 py-2.5 w-[220px] shadow-xl opacity-90">
              <h3 className="font-semibold text-sm line-clamp-2">{(activeDrag.item as Epic).title}</h3>
            </div>
          )}
          {activeDrag?.type === 'story' && (() => {
            const story = activeDrag.item as Story
            const release = map.releases.find((r) => r.id === story.release_id)
            const accentColour = release?.colour || '#D1D5DB'
            return (
              <div className="relative bg-gray-800 text-gray-200 rounded-lg px-3 py-2.5 w-[220px] border border-gray-700 shadow-xl opacity-90">
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                  style={{ backgroundColor: accentColour }}
                />
                <h4 className="text-[13px] font-medium line-clamp-2">{story.title}</h4>
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>

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
