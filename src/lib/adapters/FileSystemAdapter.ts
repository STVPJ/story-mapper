/**
 * Storage adapter that writes one JSON file per story map into a
 * user-chosen folder via the File System Access API.
 *
 * All the CRUD/debounce logic is inherited from MapSnapshotAdapterBase;
 * this only provides the file-backed snapshot sink. The folder is the
 * durable source of truth -- survives clearing site data, incognito,
 * even reinstalling the browser -- and is portable/backup-friendly.
 */

import { MapSnapshotAdapterBase, type MapSnapshotSink } from './MapSnapshotAdapterBase'
import type { StoryMap } from '../../types'
import { parseStoredMap } from '../../schemas/storedMapSchema'
import { fileNameFor } from '../fs/mapFileName'

function isNotFound(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotFoundError'
}

export class FileSystemAdapter extends MapSnapshotAdapterBase {
  /** id -> current filename, so renames replace and deletes can target. */
  private filenames = new Map<string, string>()
  private dir: FileSystemDirectoryHandle

  constructor(dir: FileSystemDirectoryHandle) {
    super()
    this.dir = dir
  }

  protected sink: MapSnapshotSink = {
    loadAll: () => this.readAllMaps(),
    persistMap: (map) => this.writeMap(map),
    removeMap: (id) => this.deleteMapFile(id),
  }

  private async readAllMaps(): Promise<StoryMap[]> {
    const maps: StoryMap[] = []
    // @ts-expect-error -- values() is part of the FSA lib but not in older DOM libs
    for await (const entry of this.dir.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
      try {
        const file = await entry.getFile()
        const map = parseStoredMap(JSON.parse(await file.text()))
        if (!map) {
          console.warn(
            `[StoryMapper] Skipping "${entry.name}": not a valid story map file.`
          )
          continue
        }
        this.filenames.set(map.id, entry.name)
        maps.push(map)
      } catch {
        console.warn(`[StoryMapper] Skipping "${entry.name}": could not be read.`)
      }
    }
    return maps.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }

  private async writeMap(map: StoryMap): Promise<void> {
    const name = fileNameFor(map)
    const handle = await this.dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(map, null, 2))
    await writable.close()

    const prev = this.filenames.get(map.id)
    if (prev && prev !== name) {
      try {
        await this.dir.removeEntry(prev)
      } catch (err) {
        if (!isNotFound(err)) throw err
      }
    }
    this.filenames.set(map.id, name)
  }

  private async deleteMapFile(id: string): Promise<void> {
    const name = this.filenames.get(id) ?? (await this.findFileNameById(id))
    if (!name) return
    try {
      await this.dir.removeEntry(name)
    } catch (err) {
      if (!isNotFound(err)) throw err
    }
    this.filenames.delete(id)
  }

  /** Fallback when the id->filename mapping is unknown (no prior load). */
  private async findFileNameById(id: string): Promise<string | null> {
    // @ts-expect-error -- values() is part of the FSA lib but not in older DOM libs
    for await (const entry of this.dir.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
      try {
        const file = await entry.getFile()
        const map = parseStoredMap(JSON.parse(await file.text()))
        if (map?.id === id) return entry.name
      } catch {
        /* ignore unreadable files */
      }
    }
    return null
  }
}
