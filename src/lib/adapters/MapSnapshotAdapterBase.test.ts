import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapSnapshotAdapterBase, type MapSnapshotSink } from './MapSnapshotAdapterBase'
import type { Epic, Feature, Release, Story, StoryMap } from '../../types'

/* ---- fixtures ---- */

function story(id: string, epic_id: string): Story {
  return {
    id, user_id: 'local', epic_id, release_id: null,
    title: id, description: '', acceptance_criteria: '', order: 0,
  }
}
function epic(id: string, feature_id: string, stories: Story[] = []): Epic {
  return {
    id, user_id: 'local', feature_id,
    title: id, description: '', acceptance_criteria: '', order: 0, stories,
  }
}
function feature(id: string, story_map_id: string, epics: Epic[] = []): Feature {
  return {
    id, user_id: 'local', story_map_id,
    title: id, description: '', acceptance_criteria: '', order: 0, epics,
  }
}
function release(id: string, story_map_id: string): Release {
  return { id, user_id: 'local', story_map_id, name: id, order: 0, colour: '#fff' }
}
function makeMap(id: string): StoryMap {
  const s = story(`${id}-s`, `${id}-e`)
  const e = epic(`${id}-e`, `${id}-f`, [s])
  const f = feature(`${id}-f`, id, [e])
  return {
    id, user_id: 'local', name: id,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    features: [f], releases: [release(`${id}-r`, id)],
  }
}

function recordingSink() {
  const loadAll = vi.fn<MapSnapshotSink['loadAll']>(async () => [])
  const persistMap = vi.fn<MapSnapshotSink['persistMap']>(async () => {})
  const removeMap = vi.fn<MapSnapshotSink['removeMap']>(async () => {})
  return { sink: { loadAll, persistMap, removeMap }, loadAll, persistMap, removeMap }
}

class TestAdapter extends MapSnapshotAdapterBase {
  protected sink: MapSnapshotSink
  constructor(sink: MapSnapshotSink) {
    super()
    this.sink = sink
  }
}

describe('MapSnapshotAdapterBase', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('init() returns the sink loadAll() result', async () => {
    const r = recordingSink()
    const maps = [makeMap('a')]
    r.loadAll.mockResolvedValue(maps)
    const adapter = new TestAdapter(r.sink)

    await expect(adapter.init()).resolves.toBe(maps)
  })

  it('createMap persists immediately (not debounced)', async () => {
    const r = recordingSink()
    const adapter = new TestAdapter(r.sink)
    const map = makeMap('a')

    await adapter.createMap(map)

    expect(r.persistMap).toHaveBeenCalledTimes(1)
    expect(r.persistMap).toHaveBeenCalledWith(map)
  })

  it('deleteMap removes immediately (not debounced)', async () => {
    const r = recordingSink()
    const adapter = new TestAdapter(r.sink)

    await adapter.deleteMap('a')

    expect(r.removeMap).toHaveBeenCalledTimes(1)
    expect(r.removeMap).toHaveBeenCalledWith('a')
  })

  it('updateFeature debounces the containing map by 300ms', async () => {
    const r = recordingSink()
    const adapter = new TestAdapter(r.sink)
    const map = makeMap('a')
    adapter._setMapsRef(() => [map])

    await adapter.updateFeature('a-f', { title: 'x' })
    expect(r.persistMap).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(r.persistMap).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(r.persistMap).toHaveBeenCalledTimes(1)
    expect(r.persistMap.mock.calls[0][0].id).toBe('a')
  })

  it('coalesces rapid edits into a single persist', async () => {
    const r = recordingSink()
    const adapter = new TestAdapter(r.sink)
    const map = makeMap('a')
    adapter._setMapsRef(() => [map])

    await adapter.updateStory('a-s', { title: '1' })
    vi.advanceTimersByTime(100)
    await adapter.updateStory('a-s', { title: '2' })
    vi.advanceTimersByTime(100)
    await adapter.updateStory('a-s', { title: '3' })
    vi.advanceTimersByTime(300)

    expect(r.persistMap).toHaveBeenCalledTimes(1)
  })

  it('deleteStory persists every currently-known map', async () => {
    const r = recordingSink()
    const adapter = new TestAdapter(r.sink)
    adapter._setMapsRef(() => [makeMap('a'), makeMap('b')])

    await adapter.deleteStory('gone')
    vi.advanceTimersByTime(300)

    expect(r.persistMap).toHaveBeenCalledTimes(2)
    expect(r.persistMap.mock.calls.map((c) => c[0].id).sort()).toEqual(['a', 'b'])
  })

  it('keeps _setMapsRef per-instance (instances do not share state)', async () => {
    const r1 = recordingSink()
    const r2 = recordingSink()
    const a1 = new TestAdapter(r1.sink)
    const a2 = new TestAdapter(r2.sink)
    a1._setMapsRef(() => [makeMap('one')])
    a2._setMapsRef(() => [makeMap('two')])

    await a1.updateFeature('one-f', { title: 'x' })
    vi.advanceTimersByTime(300)

    expect(r1.persistMap).toHaveBeenCalledTimes(1)
    expect(r1.persistMap.mock.calls[0][0].id).toBe('one')
    expect(r2.persistMap).not.toHaveBeenCalled()
  })
})
