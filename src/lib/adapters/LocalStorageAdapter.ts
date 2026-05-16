/**
 * Local-first storage adapter backed by IndexedDB.
 *
 * Each story map is stored as a single denormalised record (with all
 * features, epics, stories, and releases nested inside) so there are
 * no relational queries at the storage level.
 *
 * All the CRUD/debounce logic lives in `MapSnapshotAdapterBase`; this
 * class just points the snapshot sink at the IndexedDB wrapper.
 */

import { MapSnapshotAdapterBase, type MapSnapshotSink } from './MapSnapshotAdapterBase'
import * as db from '../storage/IndexedDB'

const LOCAL_USER_ID = 'local'

const idbSink: MapSnapshotSink = {
  loadAll: () => db.getAllMaps(),
  persistMap: (map) => db.putMap(map),
  removeMap: (id) => db.deleteMap(id),
}

export class LocalStorageAdapter extends MapSnapshotAdapterBase {
  protected sink = idbSink
}

/** Helper used by the store to generate UUIDs and timestamps. */
export { LOCAL_USER_ID }
