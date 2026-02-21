import { arrayMove } from '@dnd-kit/sortable'
import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DroppableContainer,
} from '@dnd-kit/core'

export function reorder<T extends { id: string; order: number }>(
  items: T[],
  activeId: string,
  overId: string
): T[] {
  const oldIndex = items.findIndex((i) => i.id === activeId)
  const newIndex = items.findIndex((i) => i.id === overId)
  if (oldIndex === -1 || newIndex === -1) return items
  const reordered = arrayMove(items, oldIndex, newIndex)
  return reordered.map((item, index) => ({ ...item, order: index }))
}

/** Priority values for drop target types (higher = preferred). */
const TARGET_PRIORITY: Record<string, number> = {
  story: 4,
  'release-section': 3,
  'epic-promotion': 2,
  'story-column': 1,
}

/** Valid drop targets per active item type. */
const VALID_TARGETS: Record<string, string[]> = {
  feature: ['feature'],
  epic: ['epic'],
  story: ['story', 'release-section', 'epic-promotion', 'story-column'],
}

export const multiContainerCollisionDetection: CollisionDetection = (args) => {
  const activeType = (args.active.data.current as { type?: string })?.type
  const validTargets = activeType ? VALID_TARGETS[activeType] : undefined

  const filterByType = (containers: DroppableContainer[]) => {
    if (!validTargets) return containers
    return containers.filter((c) => {
      const t = (c.data.current as { type?: string })?.type
      return t ? validTargets.includes(t) : false
    })
  }

  // Try pointerWithin first (better for nested containers)
  const pointerCollisions = pointerWithin({
    ...args,
    droppableContainers: filterByType(args.droppableContainers),
  })

  if (pointerCollisions.length > 0) {
    // Sort by priority so higher-priority targets win
    return pointerCollisions.sort((a, b) => {
      const aType = (a.data?.droppableContainer?.data?.current as { type?: string })?.type || ''
      const bType = (b.data?.droppableContainer?.data?.current as { type?: string })?.type || ''
      return (TARGET_PRIORITY[bType] || 0) - (TARGET_PRIORITY[aType] || 0)
    })
  }

  // Fallback to rectIntersection
  return rectIntersection({
    ...args,
    droppableContainers: filterByType(args.droppableContainers),
  })
}
