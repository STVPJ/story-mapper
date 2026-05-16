import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileSystemAdapter } from './FileSystemAdapter'
import type { StoryMap } from '../../types'

/* ---- fake FileSystemDirectoryHandle backed by a Map<filename,content> ---- */

function notFound() {
  return new DOMException('not found', 'NotFoundError')
}

function makeDir(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial))
  const fileHandle = (name: string) => ({
    kind: 'file' as const,
    name,
    async getFile() {
      return { text: async () => files.get(name) ?? '' }
    },
    async createWritable() {
      let buf = ''
      return {
        async write(s: string) {
          buf = s
        },
        async close() {
          files.set(name, buf)
        },
      }
    },
  })
  const dir = {
    files,
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      if (!files.has(name) && !opts?.create) throw notFound()
      if (!files.has(name)) files.set(name, '')
      return fileHandle(name)
    },
    async removeEntry(name: string) {
      if (!files.has(name)) throw notFound()
      files.delete(name)
    },
    async *values() {
      for (const name of [...files.keys()]) yield fileHandle(name)
    },
  }
  return dir as unknown as FileSystemDirectoryHandle & { files: Map<string, string> }
}

function makeMap(id: string, name: string, updated_at: string): StoryMap {
  return {
    id,
    user_id: 'local',
    name,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at,
    features: [
      {
        id: `${id}-f`,
        user_id: 'local',
        story_map_id: id,
        title: 'F',
        description: '',
        acceptance_criteria: '',
        order: 0,
        epics: [
          {
            id: `${id}-e`,
            user_id: 'local',
            feature_id: `${id}-f`,
            title: 'E',
            description: '',
            acceptance_criteria: '',
            order: 0,
            stories: [
              {
                id: `${id}-s`,
                user_id: 'local',
                epic_id: `${id}-e`,
                release_id: null,
                title: 'S',
                description: '',
                acceptance_criteria: '',
                order: 0,
              },
            ],
          },
        ],
      },
    ],
    releases: [
      { id: `${id}-r`, user_id: 'local', story_map_id: id, name: 'R1', order: 0, colour: '#aabbcc' },
    ],
  }
}

describe('FileSystemAdapter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('persistMap writes pretty JSON to <slug>--<id6>.json', async () => {
    const dir = makeDir()
    const adapter = new FileSystemAdapter(dir)
    const map = makeMap('abcdef12-zzz', 'My Plan', '2026-02-01T00:00:00.000Z')

    await adapter.createMap(map)

    const fname = 'my-plan--abcdef.json'
    expect(dir.files.has(fname)).toBe(true)
    expect(dir.files.get(fname)).toBe(JSON.stringify(map, null, 2))
  })

  it('loadAll parses, validates and sorts maps newest-first', async () => {
    const older = makeMap('aaaaaa', 'Older', '2026-01-10T00:00:00.000Z')
    const newer = makeMap('bbbbbb', 'Newer', '2026-03-10T00:00:00.000Z')
    const dir = makeDir({
      'older--aaaaaa.json': JSON.stringify(older),
      'newer--bbbbbb.json': JSON.stringify(newer),
      'notes.txt': 'ignored',
    })
    const adapter = new FileSystemAdapter(dir)

    const maps = await adapter.init()

    expect(maps.map((m) => m.id)).toEqual(['bbbbbb', 'aaaaaa'])
  })

  it('skips malformed JSON files with a warning, keeps the rest', async () => {
    const good = makeMap('good11', 'Good', '2026-02-01T00:00:00.000Z')
    const dir = makeDir({
      'good--good11.json': JSON.stringify(good),
      'broken--xxxxxx.json': '{ not valid json',
      'wrong--yyyyyy.json': JSON.stringify({ totally: 'not a map' }),
    })
    const adapter = new FileSystemAdapter(dir)

    const maps = await adapter.init()

    expect(maps.map((m) => m.id)).toEqual(['good11'])
    expect(console.warn).toHaveBeenCalled()
  })

  it('round-trips a map through write then read', async () => {
    const dir = makeDir()
    const adapter = new FileSystemAdapter(dir)
    const map = makeMap('rt1234', 'Round Trip', '2026-02-02T00:00:00.000Z')

    await adapter.createMap(map)
    const reloaded = await new FileSystemAdapter(dir).init()

    expect(reloaded).toEqual([map])
  })

  it('renames the file when the map name changes (no orphan)', async () => {
    const dir = makeDir()
    const adapter = new FileSystemAdapter(dir)
    const map = makeMap('ren123', 'First Name', '2026-02-01T00:00:00.000Z')
    await adapter.createMap(map)
    expect(dir.files.has('first-name--ren123.json')).toBe(true)

    await adapter.createMap({ ...map, name: 'Second Name' })

    expect(dir.files.has('second-name--ren123.json')).toBe(true)
    expect(dir.files.has('first-name--ren123.json')).toBe(false)
  })

  it('removeMap deletes the file and is a no-op when already gone', async () => {
    const map = makeMap('del123', 'Doomed', '2026-02-01T00:00:00.000Z')
    const dir = makeDir({ 'doomed--del123.json': JSON.stringify(map) })
    const adapter = new FileSystemAdapter(dir)
    await adapter.init()

    await adapter.deleteMap('del123')
    expect(dir.files.has('doomed--del123.json')).toBe(false)

    await expect(adapter.deleteMap('del123')).resolves.toBeUndefined()
  })
})
