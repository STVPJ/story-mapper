# Product Requirements Document: StoryMapper

## Problem Statement

Story mapping is one of the most effective techniques in product management for turning discovery work into a structured set of requirements. It gives PMs a way to think about user journeys holistically before breaking them down into deliverable chunks of work.

The problem is with the tooling. Existing options fall into two categories:

1. **Enterprise story mapping platforms** (Avion, StoriesOnBoard, Easy Agile, etc.) — feature-rich but carry subscription costs that are hard to justify for individual PMs, small teams, or discovery-phase work where you don't yet know if the project will proceed. They also bundle backlog management, sprint planning, and collaboration features that add complexity without adding value when you just need to map requirements.

2. **Generic whiteboard tools** (Miro templates, Lucid sticky notes, FigJam) — cheap or free, but with no underlying data model. A story map in Miro is just rectangles on a canvas. You can't export the hierarchy, validate it, or feed it into downstream tools without manually transcribing everything.

The gap is a tool that provides genuine structure — a real Feature → Epic → Story hierarchy with release slicing — without the overhead of an enterprise platform, and **without requiring any backend account or hosted service**. A real-world constraint motivated this: a tool whose data lives only in a hosted database is unusable on a locked-down corporate machine where external cloud services are blocked, and the data isn't portable between environments. StoryMapper must work entirely offline by default, store each map as a portable file, and still produce structured output (JSON, plus Jira/Azure DevOps CSV) that downstream delivery tools or LLM-assisted workflows can consume.

---

## Outcome Requirements

These are the outcomes StoryMapper is designed to achieve. They informed every design and scoping decision in this document.

| # | Outcome | Success Measure |
|---|---------|-----------------|
| O1 | A PM can capture a complete requirements hierarchy in a single working session | A new story map with Features, Epics, Stories, and release assignments can be created from scratch in under 30 minutes |
| O2 | The hierarchy is structured, not freeform | Every item belongs to a typed level (Feature → Epic → Story) with enforced parent-child relationships and ordering |
| O3 | Requirements can be sliced by release to communicate delivery sequencing | Stories are assignable to named, ordered releases with visual dividers on the board |
| O4 | The structured output is machine-readable and tool-ready | Export produces a JSON file preserving the full hierarchy, plus Jira and Azure DevOps CSV exports for direct import into those tools |
| O5 | The tool runs at zero ongoing cost and with no account | The default mode requires no server, no database, no sign-up, and no environment variables — it runs entirely in the browser |
| O6 | It works in restricted environments and is fully portable | Runs offline with no external network calls in the default mode; each map exports/imports as a single self-contained JSON file |
| O7 | Interaction is fast enough that the tool doesn't slow down thinking | Drag-and-drop, card editing, and navigation feel instant through optimistic updates; no loading spinners during normal use |
| O8 | Data is private by default, with an optional path to multi-device sync | Default storage is browser-sandboxed and never leaves the machine; an optional Supabase backend adds authenticated, row-level-isolated cloud sync without changing the app's data model |

---

## Solution Overview

StoryMapper is a single-page React application that provides a visual board for organising work into a three-level hierarchy (Features → Epics → Stories) with horizontal release slicing, drag-and-drop interaction, and card-based editing.

It is **local-first**. By default all data persists to the browser's IndexedDB — no account, no server, no network. Maps are exported and re-imported as JSON files for backup, sharing, and portability, and exported as CSV for Jira or Azure DevOps.

An optional Supabase backend can be enabled by setting environment variables, providing authenticated cloud sync and multi-device access. The persistence layer is abstracted behind a `StorageAdapter` interface, so the cloud backend is genuinely optional and a custom backend can be added without touching the rest of the app. The app deploys as a static site (Vercel or any static host).

---

## Tech Stack

- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4 (CSS-first configuration, `@import "tailwindcss"` in index.css, `@tailwindcss/vite` plugin)
- **Drag and Drop:** @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- **State Management:** Zustand (single store, optimistic updates)
- **Validation:** Zod (JSON import validation)
- **Local Storage (default):** Browser IndexedDB — no library, no server
- **Cloud Storage (optional):** Supabase (PostgreSQL with Row Level Security)
- **Authentication (optional, cloud mode only):** Supabase Auth with GitHub OAuth
- **Deployment:** Vercel (static site) or any static host
- **Icons:** Lucide React
- **Testing:** Vitest (171 tests across 5 test files)
- **IDs:** Client-generated UUIDs via `crypto.randomUUID()`

Single-user per browser (default) or per account (optional cloud mode). No shared/collaborative features.

---

## Storage Architecture

### Storage Adapter Pattern

Persistence is abstracted behind a `StorageAdapter` interface (`src/lib/adapters/StorageAdapter.ts`). The store never talks to a backend directly; it talks to whichever adapter `createAdapter()` resolves at runtime:

- **`LocalStorageAdapter`** (default) — backed by IndexedDB (`src/lib/storage/IndexedDB.ts`). Each story map is stored as a single denormalised record keyed by its UUID, so startup is one read and each mutation is one write. Writes are debounced at 300ms.
- **`SupabaseAdapter`** (optional) — backed by Supabase PostgreSQL. Activated only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. The Supabase SDK is loaded via dynamic import, so in the default build it is not bundled and the app makes zero network requests.

`createAdapter()` (`src/lib/adapters/index.ts`) inspects environment variables and returns the appropriate adapter. To add a custom backend (Firebase, a REST API, etc.), implement `StorageAdapter` and extend the factory.

### Data Flow

The Zustand store (`src/store/useStoryMapStore.ts`) is the single source of truth. Every mutation follows the optimistic update pattern:

1. Update Zustand state immediately (UI reflects the change instantly).
2. Sync to the active storage adapter in the background.
3. On failure, roll back state and surface the error via a toast.

---

## Data Model

The canonical model is the set of TypeScript interfaces in `src/types/index.ts`. All IDs are generated client-side with `crypto.randomUUID()` and are stable across export/import-into-the-same-store boundaries (import always re-generates IDs to avoid collisions). The `user_id` field is set to the literal `'local'` in local mode and to the authenticated user's id in cloud mode.

```typescript
interface StoryMap {
  id: string
  user_id: string
  name: string
  created_at: string       // ISO 8601
  updated_at: string       // ISO 8601
  features: Feature[]
  releases: Release[]
}

interface Feature {
  id: string
  user_id: string
  story_map_id: string
  title: string
  description: string
  acceptance_criteria: string
  order: number
  epics: Epic[]
}

interface Epic {
  id: string
  user_id: string
  feature_id: string
  title: string
  description: string
  acceptance_criteria: string
  order: number
  stories: Story[]
}

interface Story {
  id: string
  user_id: string
  epic_id: string
  release_id: string | null
  title: string
  description: string
  acceptance_criteria: string
  order: number
}

interface Release {
  id: string
  user_id: string
  story_map_id: string
  name: string
  order: number
  colour: string
}
```

### Key Relationships

- A StoryMap contains multiple Features (ordered left to right).
- A Feature contains multiple Epics (ordered left to right as columns beneath the Feature).
- An Epic contains multiple Stories (ordered top to bottom within the Epic's column).
- Releases slice horizontally across ALL Epic columns. Stories are assigned to a Release (or unassigned).
- Each card type (Feature, Epic, Story) shares the same three editable fields: title, description, acceptance criteria.

### Optional Cloud Schema

In cloud mode the same model is stored relationally in Supabase. The complete schema — five data tables plus the invite-only access tables, all with Row Level Security enforcing `auth.uid() = user_id`, foreign-key cascades, and a hex-colour check constraint — ships as a single runnable script at [`supabase/schema.sql`](supabase/schema.sql). It is not needed for the default local mode.

---

## Visual Layout

The board reads left-to-right and top-to-bottom:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Feature A]                    │  [Feature B]                      │
├─────────────┬───────────────────├─────────────┬─────────────────────│
│  [Epic A1]  │  [Epic A2]       │  [Epic B1]  │  [Epic B2]          │
├─────────────┼───────────────────├─────────────┼─────────────────────│
│             │                   │             │                     │
│  ─ ─ ─ ─ ─ Release 1 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  [Story A1a]│  [Story A2a]     │  [Story B1a]│  [Story B2a]        │
│  [Story A1b]│                  │             │  [Story B2b]        │
│             │                   │             │                     │
│  ─ ─ ─ ─ ─ Release 2 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  [Story A1c]│  [Story A2b]     │  [Story B1b]│                     │
│             │  [Story A2c]     │             │                     │
│             │                   │             │                     │
│  ─ ─ ─ ─ ─ Unassigned ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  [Story A1d]│                  │  [Story B1c]│  [Story B2c]        │
└─────────────┴───────────────────┴─────────────┴─────────────────────┘
```

### Row Structure

- **Row 1 (Feature row):** Feature cards span across their child Epic columns.
- **Row 2 (Epic row):** One Epic card per column, directly beneath its parent Feature.
- **Rows 3+ (Story area):** Stories stacked vertically within each Epic column, separated by horizontal release dividers.

---

## Card Design

All three card types are visually distinct through colour, size, and typography.

### Feature Cards

- **Background:** Deep indigo (`#312E81`)
- **Text:** White
- **Size:** Spans the full width of all child Epic columns beneath it
- **Typography:** Bold, larger font size (16px+)
- **Content shown:** Title only (single line, truncated with ellipsis)

### Epic Cards

- **Background:** Teal (`#0891B2`)
- **Text:** White
- **Size:** Fixed column width (~220px), moderate height
- **Typography:** Semi-bold, medium font size (14px)
- **Content shown:** Title (up to 2 lines, truncated with ellipsis)

### Story Cards

- **Background:** Dark grey (`bg-gray-800`)
- **Text:** Light grey (`text-gray-200`)
- **Size:** Fixed column width (~220px), compact height
- **Border:** 1px solid dark grey (`border-gray-700`)
- **Typography:** Regular weight, smaller font size (13px)
- **Content shown:** Title (up to 2 lines) + first line of description (truncated, muted)
- **Left accent:** 4px left border in the assigned Release colour (neutral grey if unassigned)

### General Card Behaviour

- All cards have `border-radius: 8px` and a subtle box shadow on hover
- Cursor changes to grab/move on hover over the card body
- A small drag handle (grip dots) appears in the top-right corner on hover
- Brief scale-up transition on hover (e.g. `transform: scale(1.02)`)
- While dragging, the card becomes semi-transparent with a more prominent shadow

---

## Interactions

### Card Modal (Edit View)

Clicking any card opens a modal dialogue with:

1. **Title** (text input, single line, required, auto-focused on open)
2. **Description** (textarea, multi-line, plain text, optional)
3. **Acceptance Criteria** (textarea, multi-line, plain text, optional)

Modal behaviour:

- Opens centred with a semi-transparent backdrop
- Closes on backdrop click, Escape key, or the close button (X)
- Changes save automatically on close (no explicit save button)
- Header shows the card type as a coloured badge ("Feature", "Epic", "Story")
- A delete button in the footer with a confirmation step ("This will also delete all child items.")
- For a Story, a dropdown allows assigning/changing the Release

### Drag and Drop

| Dragged Item | Valid Drop Targets | Behaviour |
|---|---|---|
| Feature | Before/after another Feature | Reorders Features horizontally |
| Epic | Before/after another Epic (same or different Feature) | Reorders Epics. Moving to a different Feature re-parents the Epic and all its child Stories |
| Story | Before/after another Story (same or different Epic/release section) | Reorders Stories. Dropping into a different release section changes the Story's `release_id`. Dropping under a different Epic re-parents the Story |

#### Promotion: Story to Epic

- Dragging a Story into the Epic row promotes it to an Epic.
- The Story's title, description, and acceptance criteria transfer to the new Epic.
- The new Epic is created with zero child Stories; the original Story is removed.

#### Moving an Epic moves its Stories

- When an Epic is moved (within or across Features), all child Stories move with it, retaining their order and release assignments.

#### Visual Feedback During Drag

- Drop targets are highlighted with coloured rings: indigo (Features), cyan (Epics), blue (story release sections), teal (Epic promotion zone).
- Invalid drop zones show no indicator.
- A ghost card (DragOverlay) follows the cursor at reduced opacity, styled to match the dragged card type, rendered outside the zoom transform so it tracks the cursor 1:1.

### Adding New Items

- **Add Feature:** "+ Add Feature" button at the far right of the Feature row.
- **Add Epic:** "+ Add Epic" button at the right end of each Feature's Epic row.
- **Add Story:** "+ Add Story" button at the bottom of each Epic column (within each release section, or at the bottom if no releases exist).

Each creates an item with a default title and opens the modal for editing.

### Release Management

A "Manage Releases" control in the toolbar opens a side panel where the user can:

- Add a release (name + colour from a preset palette, customisable)
- Rename and reorder releases (drag to reorder; top = highest priority)
- Delete a release (its Stories become unassigned, not deleted)

Release dividers on the board are dashed horizontal lines spanning the story area, labelled with the release name, coloured to match the release, always shown in order with an "Unassigned" section at the bottom.

---

## Story Map Management

### Home Screen

When no map is open:

- List of saved story maps (name + last modified date)
- "Create New Map" button
- "Import" button — uploads a previously exported JSON file (Zod-validated) and creates a new map from it
- Per-map context menu (three-dot on hover): rename, duplicate, delete
- Rename uses a styled prompt dialog; delete uses a styled danger confirmation dialog
- Click a map to open it

### Toolbar (When a Map is Open)

- **Map name** (editable inline)
- **Back to Home** button
- **Manage Releases** button
- **Export** dropdown — JSON (full, re-importable), Jira CSV, Azure DevOps CSV
- **Zoom controls** (in, out, fit to screen) via CSS transform on the board container
- **Cloud mode only:** user avatar + sign-out menu; "Manage Access" for admins

---

## Persistence

### Default: Local (IndexedDB)

- All data persists to the browser's IndexedDB via `LocalStorageAdapter`.
- Each map is one denormalised record; one read on startup, one debounced write (300ms) per mutation.
- Data is sandboxed by the browser's same-origin policy and never leaves the machine.
- No environment variables, accounts, or network connectivity required. The app is fully functional offline.

### Optional: Cloud (Supabase)

- Enabled by setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `SupabaseAdapter` writes each mutation to PostgreSQL; bulk reorder writes are debounced at 300ms with a per-table timeout map (`features`, `epics`, `stories`, `releases`) so concurrent reorders across tables don't cancel each other.
- All access is governed by Row Level Security (`auth.uid() = user_id`), not application-level checks.
- The Supabase SDK is dynamically imported, so enabling cloud mode is the only thing that pulls it into the bundle.

### Optimistic Updates & Loading

- The UI updates immediately; the adapter write happens in the background.
- On failure, the optimistic change is rolled back and a toast error is shown.
- A skeleton/loading state covers only the initial hydration. Individual card saves show no spinner.

### Export / Import

- **JSON export** serialises the selected map (features, epics, stories, releases) to a single downloadable file, re-importable into StoryMapper.
- **Jira CSV** maps Feature → Epic, Epic → Story, Story → Sub-task.
- **Azure DevOps CSV** maps Feature → Epic, Epic → Feature, Story → User Story, using hierarchical Title columns.
- **JSON import** validates against `src/schemas/importSchema.ts` (Zod): max 100 features, 50 epics/feature, 200 stories/epic; title ≤ 500, description/acceptance ≤ 10,000, map/release name ≤ 200 chars; release colour must match `^#[0-9a-fA-F]{6}$`. On failure the first Zod error path is surfaced in a toast and nothing is written. Valid data is assigned fresh UUIDs.

---

## Authentication (Cloud Mode Only)

In the default local mode there is **no authentication** — the app opens straight to the Home Screen and a fake `'local'` user is used internally.

When a Supabase backend is configured, StoryMapper uses Supabase Auth with GitHub as the sole OAuth provider, plus an invite-only access model:

1. User clicks "Sign in with GitHub"; Supabase handles the OAuth redirect (redirect URL scoped to `window.location.origin`).
2. On success, the app checks the `allowed_users` table for the user's email.
3. If absent, the user sees an access-request form instead of the app.
4. An admin (any user already on the allowlist) approves or denies requests from the "Manage Access" panel.
5. All data is scoped per user by RLS.

`AuthProvider` selects a local (no-op) provider or the Supabase provider based on the same environment-variable check used by the storage factory. Environment variables (cloud mode only):

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

The first admin is seeded by hand (`insert into public.allowed_users (email) values ('you@example.com');`) as documented at the end of `supabase/schema.sql`.

---

## Non-Functional Requirements

### Performance (supports O7)

- The board must remain responsive with up to 10 Features, 50 Epics, and 200 Stories.
- Drag-and-drop must feel smooth at 60fps.
- All mutations use optimistic updates; bulk reorder writes are debounced at 300ms.

### Privacy & Data Isolation (supports O8)

- **Local mode:** data is browser-sandboxed (same-origin policy); nothing leaves the machine; no credentials exist.
- **Cloud mode:** all tables enforce RLS scoped to `auth.uid() = user_id`; the only client credential is the public Supabase anon key, which cannot bypass RLS.
- Imported JSON is Zod-validated before any write; malformed or oversized imports are rejected with a descriptive error.

### Cost (supports O5)

- Default mode has zero infrastructure cost: no server, no database, no third-party SaaS.
- Optional cloud mode is viable on free-tier Supabase + Vercel hobby. No per-seat or usage-based billing.

### Accessibility

- All interactive elements keyboard-navigable; modal focus trapping (Tab cycles within the open modal).
- ARIA labels on drag-and-drop elements.
- WCAG AA colour contrast minimum on all card types.

### Browser Support

- Latest Chrome, Firefox, Safari, Edge. No IE11.

### Responsive Behaviour

- Designed for desktop (1280px+); board is horizontally scrollable on overflow.
- On smaller screens, a warning indicates the tool is best used on desktop.

---

## Out of Scope (Explicitly Not Building)

- Multi-user collaboration or shared maps
- Real-time sync or conflict resolution
- Estimation, story points, or velocity tracking
- Sprint planning or sprint boards
- Comments, attachments, or activity logs
- Custom card fields beyond title, description, and acceptance criteria
- Markdown or rich text editing in card fields
- Additional OAuth providers beyond GitHub (cloud mode)
- Undo/redo functionality (consider for v2)
- Keyboard shortcuts for board navigation (consider for v2)

> Note: Jira/Azure DevOps export and full offline operation, previously out of scope, are now core capabilities.

---

## Project Structure

```
story-mapper/
├── public/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── AuthProvider.tsx        # Local or Supabase auth context
│   │   │   ├── LoginPage.tsx           # GitHub OAuth (cloud mode)
│   │   │   ├── AccessRequestPage.tsx   # Invite-only request form (cloud mode)
│   │   │   └── UserMenu.tsx            # Avatar + sign out (cloud mode)
│   │   ├── Admin/
│   │   │   └── AdminPanel.tsx          # Approve/deny access requests (cloud mode)
│   │   ├── Board/
│   │   │   ├── Board.tsx               # Main board: DndContext, zoom, modals
│   │   │   ├── EpicRow.tsx             # Epic cards under a feature + promotion zone
│   │   │   ├── StoryColumn.tsx         # Stories within a feature, grouped by release
│   │   │   ├── StoryCell.tsx           # One feature+release drop zone
│   │   │   └── ReleaseDivider.tsx      # Horizontal release separator
│   │   ├── Cards/
│   │   │   ├── FeatureCard.tsx
│   │   │   ├── EpicCard.tsx
│   │   │   └── StoryCard.tsx
│   │   ├── Modal/
│   │   │   ├── CardModal.tsx           # Edit modal for any card type
│   │   │   └── ReleaseManager.tsx      # Release CRUD side panel
│   │   ├── Home/
│   │   │   └── HomeScreen.tsx          # Map listing, creation, JSON import
│   │   ├── Toolbar/
│   │   │   └── Toolbar.tsx             # Top bar: name, export, zoom, releases
│   │   ├── shared/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── ColourPicker.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── PromptDialog.tsx
│   │   └── components.test.tsx
│   ├── lib/
│   │   ├── adapters/
│   │   │   ├── StorageAdapter.ts       # Persistence interface
│   │   │   ├── LocalStorageAdapter.ts  # IndexedDB (default)
│   │   │   ├── SupabaseAdapter.ts      # Supabase (optional)
│   │   │   └── index.ts                # createAdapter() factory + isLocalMode()
│   │   ├── storage/
│   │   │   └── IndexedDB.ts            # Thin IndexedDB wrapper
│   │   └── exporters/
│   │       ├── csv.ts                  # Shared CSV helpers
│   │       ├── jira.ts                 # Jira CSV exporter
│   │       └── ado.ts                  # Azure DevOps CSV exporter
│   ├── schemas/
│   │   ├── importSchema.ts             # Zod schema for JSON import
│   │   └── importSchema.test.ts
│   ├── store/
│   │   ├── useStoryMapStore.ts         # Zustand store (adapter-driven)
│   │   └── useStoryMapStore.test.ts
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces
│   ├── utils/
│   │   ├── dnd.ts                      # DnD collision detection
│   │   ├── dnd.test.ts
│   │   ├── colours.ts                  # Colour palette and helpers
│   │   └── colours.test.ts
│   ├── test/
│   │   └── setup.ts                    # Vitest setup
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── schema.sql                      # Optional cloud schema + RLS
├── .env.example                        # Cloud-mode env template
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vite.config.ts
```

---

## Key Implementation Details

- The store never imports a backend directly; it depends only on the `StorageAdapter` interface. `createAdapter()` resolves the concrete adapter from environment variables at startup.
- The Supabase client is loaded via dynamic `import()`, so the default build excludes the SDK entirely and makes no network requests.
- IndexedDB persistence stores one record per map; the local adapter holds a live reference to the store's maps so it can persist the full map object without a circular dependency.
- Use `@dnd-kit/core` with a 5px activation distance to distinguish clicks from drags. Sortable transforms are divided by the current zoom factor so cards track the cursor 1:1; the DragOverlay renders outside the zoomed container.
- Feature cards use `grid-column: span N` (N = child Epic count); the story area uses an aligned grid so release dividers line up across all Epic columns.
- Story-to-Epic promotion is detected via a dedicated droppable zone (`data` attribute) in the Epic row.
- In cloud mode, every adapter write sets `user_id` from the authenticated session (`supabase.auth.getUser()`); on an expired session the adapter surfaces an error and the store rolls back.
- Errors are caught and shown as generic user-facing toast messages — no stack traces or internal state in the UI. Failed optimistic updates roll back and the store re-hydrates from the adapter.

### Empty States

- No maps yet: "Create your first story map to get started" with a prominent CTA
- No Features in a map: prompt with an arrow pointing to the add button
- No Epics under a Feature: muted "+ Add Epic" placeholder
- No Stories under an Epic: muted "+ Add Story" placeholder
- No Releases defined: Stories listed in order with no dividers; a subtle prompt suggests creating releases
