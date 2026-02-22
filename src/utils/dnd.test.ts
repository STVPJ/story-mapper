import { describe, it, expect } from 'vitest'
import { reorder } from './dnd'

describe('reorder', () => {
  const items = [
    { id: 'a', order: 0, name: 'A' },
    { id: 'b', order: 1, name: 'B' },
    { id: 'c', order: 2, name: 'C' },
    { id: 'd', order: 3, name: 'D' },
  ]

  it('moves item forward and updates order indices', () => {
    const result = reorder(items, 'a', 'c')
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(result.map((i) => i.order)).toEqual([0, 1, 2, 3])
  })

  it('moves item backward and updates order indices', () => {
    const result = reorder(items, 'c', 'a')
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(result.map((i) => i.order)).toEqual([0, 1, 2, 3])
  })

  it('returns original array when activeId not found', () => {
    const result = reorder(items, 'x', 'a')
    expect(result).toBe(items)
  })

  it('returns original array when overId not found', () => {
    const result = reorder(items, 'a', 'x')
    expect(result).toBe(items)
  })

  it('handles adjacent swap', () => {
    const result = reorder(items, 'a', 'b')
    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(result.map((i) => i.order)).toEqual([0, 1, 2, 3])
  })

  it('handles move to end', () => {
    const result = reorder(items, 'a', 'd')
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'd', 'a'])
    expect(result.map((i) => i.order)).toEqual([0, 1, 2, 3])
  })

  it('handles same position (no-op)', () => {
    const result = reorder(items, 'b', 'b')
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(result.map((i) => i.order)).toEqual([0, 1, 2, 3])
  })

  it('preserves extra properties on items', () => {
    const result = reorder(items, 'a', 'c')
    expect(result.find((i) => i.id === 'a')?.name).toBe('A')
    expect(result.find((i) => i.id === 'b')?.name).toBe('B')
    expect(result.find((i) => i.id === 'c')?.name).toBe('C')
    expect(result.find((i) => i.id === 'd')?.name).toBe('D')
  })

  it('handles two-item array', () => {
    const two = [
      { id: 'x', order: 0 },
      { id: 'y', order: 1 },
    ]
    const result = reorder(two, 'y', 'x')
    expect(result.map((i) => i.id)).toEqual(['y', 'x'])
    expect(result.map((i) => i.order)).toEqual([0, 1])
  })
})
