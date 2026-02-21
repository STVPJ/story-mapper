/**
 * In-memory mock Supabase client for local development without authentication.
 * Activated by setting VITE_DEV_BYPASS_AUTH=true in .env.local
 */

const DEV_USER_ID = 'dev-user-00000000-0000-0000-0000-000000000000'

const tables: Record<string, Record<string, unknown>[]> = {
  story_maps: [],
  features: [],
  epics: [],
  stories: [],
  releases: [],
}

const columnDefaults: Record<string, Record<string, unknown>> = {
  features: { title: 'New Feature', description: '', acceptance_criteria: '' },
  epics: { title: 'New Epic', description: '', acceptance_criteria: '' },
  stories: { title: 'New Story', description: '', acceptance_criteria: '', release_id: null },
  releases: { name: 'New Release', colour: '#6366F1' },
  story_maps: { name: 'Untitled Map' },
}

function nestStoryMaps(rows: Record<string, unknown>[]) {
  return rows.map((map) => ({
    ...map,
    features: (tables.features || [])
      .filter((f) => f.story_map_id === map.id)
      .map((f) => ({
        ...f,
        epics: (tables.epics || [])
          .filter((e) => e.feature_id === f.id)
          .map((e) => ({
            ...e,
            stories: (tables.stories || []).filter((s) => s.epic_id === e.id),
          })),
      })),
    releases: (tables.releases || []).filter((r) => r.story_map_id === map.id),
  }))
}

class MockQueryBuilder {
  private _table: string
  private _op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private _insertData: Record<string, unknown> | null = null
  private _updateData: Record<string, unknown> | null = null
  private _filters: Array<[string, unknown]> = []
  private _selectQuery = '*'
  private _orderCol: string | null = null
  private _orderAsc = true
  private _isSingle = false

  constructor(table: string) {
    this._table = table
  }

  select(query?: string) {
    if (this._op !== 'insert') {
      this._op = 'select'
    }
    if (query) this._selectQuery = query
    return this
  }

  insert(data: Record<string, unknown>) {
    this._op = 'insert'
    const defaults = columnDefaults[this._table] || {}
    this._insertData = {
      ...defaults,
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (!tables[this._table]) tables[this._table] = []
    tables[this._table].push(this._insertData)
    return this
  }

  update(data: Record<string, unknown>) {
    this._op = 'update'
    this._updateData = data
    return this
  }

  delete() {
    this._op = 'delete'
    return this
  }

  eq(col: string, val: unknown) {
    this._filters.push([col, val])
    if (this._op === 'update' && this._updateData) {
      tables[this._table] = tables[this._table].map((row) =>
        row[col] === val ? { ...row, ...this._updateData } : row
      )
    } else if (this._op === 'delete') {
      tables[this._table] = tables[this._table].filter((row) => row[col] !== val)
    }
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col
    this._orderAsc = opts?.ascending ?? true
    return this
  }

  single() {
    this._isSingle = true
    return this._resolve()
  }

  then(
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) {
    return this._resolve().then(onFulfilled, onRejected)
  }

  private _resolve(): Promise<{ data: unknown; error: null }> {
    if (this._op === 'insert') {
      return Promise.resolve({ data: this._insertData, error: null })
    }

    if (this._op === 'select') {
      let rows = [...(tables[this._table] || [])]
      for (const [col, val] of this._filters) {
        rows = rows.filter((r) => r[col] === val)
      }

      if (this._table === 'story_maps' && this._selectQuery.includes('features(')) {
        rows = nestStoryMaps(rows)
      }

      if (this._orderCol) {
        const col = this._orderCol
        const asc = this._orderAsc
        rows.sort((a, b) => {
          const av = a[col] as string | number
          const bv = b[col] as string | number
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return asc ? cmp : -cmp
        })
      }

      if (this._isSingle) {
        return Promise.resolve({ data: rows[0] || null, error: null })
      }
      return Promise.resolve({ data: rows, error: null })
    }

    return Promise.resolve({ data: null, error: null })
  }
}

const mockSession = {
  user: {
    id: DEV_USER_ID,
    email: 'dev@localhost',
    user_metadata: {
      avatar_url: '',
      full_name: 'Dev User',
    },
  },
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
}

export const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: mockSession } }),
    getUser: () => Promise.resolve({ data: { user: mockSession.user } }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: () => {
      window.location.reload()
      return Promise.resolve({})
    },
    signInWithOAuth: () => Promise.resolve({}),
  },
  from: (table: string) => new MockQueryBuilder(table),
}
