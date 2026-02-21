import { arrayMove } from '@dnd-kit/sortable'

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
