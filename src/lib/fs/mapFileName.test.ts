import { describe, expect, it } from 'vitest'
import { slugify, fileNameFor } from './mapFileName'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Mobile Redesign')).toBe('mobile-redesign')
  })
  it('strips punctuation and collapses separators', () => {
    expect(slugify('  Q3 // Roadmap!!  ')).toBe('q3-roadmap')
  })
  it('keeps digits', () => {
    expect(slugify('Release 2026 v2')).toBe('release-2026-v2')
  })
  it('falls back to "map" when nothing usable remains', () => {
    expect(slugify('###')).toBe('map')
    expect(slugify('   ')).toBe('map')
    expect(slugify('')).toBe('map')
  })
  it('reduces accented characters to their base letters', () => {
    expect(slugify('Café Plan')).toBe('cafe-plan')
  })
})

describe('fileNameFor', () => {
  it('combines slug with a 6-char id prefix and .json', () => {
    expect(fileNameFor({ id: 'a1b2c3d4-e5f6', name: 'My Map' })).toBe(
      'my-map--a1b2c3.json'
    )
  })
  it('disambiguates duplicate names by the id prefix', () => {
    const a = fileNameFor({ id: 'aaaaaa11', name: 'Plan' })
    const b = fileNameFor({ id: 'bbbbbb22', name: 'Plan' })
    expect(a).not.toBe(b)
    expect(a).toBe('plan--aaaaaa.json')
    expect(b).toBe('plan--bbbbbb.json')
  })
})
