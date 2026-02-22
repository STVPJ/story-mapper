import { describe, it, expect } from 'vitest'
import { RELEASE_COLOURS, FEATURE_BG, EPIC_BG } from './colours'

describe('colour constants', () => {
  it('exports exactly 10 release colours', () => {
    expect(RELEASE_COLOURS).toHaveLength(10)
  })

  it('all release colours are valid hex strings', () => {
    for (const colour of RELEASE_COLOURS) {
      expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('release colours are unique', () => {
    const unique = new Set(RELEASE_COLOURS)
    expect(unique.size).toBe(RELEASE_COLOURS.length)
  })

  it('FEATURE_BG is deep indigo #312E81', () => {
    expect(FEATURE_BG).toBe('#312E81')
  })

  it('EPIC_BG is teal #0891B2', () => {
    expect(EPIC_BG).toBe('#0891B2')
  })

  it('release colours match expected palette', () => {
    expect(RELEASE_COLOURS).toEqual([
      '#6366F1', // indigo
      '#8B5CF6', // violet
      '#EC4899', // pink
      '#EF4444', // red
      '#F97316', // orange
      '#EAB308', // yellow
      '#22C55E', // green
      '#14B8A6', // teal
      '#06B6D4', // cyan
      '#3B82F6', // blue
    ])
  })
})
