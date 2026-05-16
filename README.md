# StoryMapper

A lightweight, local-first story mapping tool built to solve a real problem in product management: capturing and structuring early requirements without paying for enterprise tooling you don't need.

**No account needed. No server needed. Just clone, build, and start mapping.**

**Note:** I'm a Product Manager, not a software engineer. I wrote the PRD and made all product decisions, but the code was written entirely by AI -- [Claude Code](https://claude.ai/code) for development and Google Gemini for code review.

## Why I Built This

As a Product Manager, story mapping is one of the most effective techniques for early discovery, breaking down requirements and planning releases. But the existing tools fall into two camps:

- **Enterprise platforms** (Avion, StoriesOnBoard, etc.) -- powerful, but their subscription costs are hard to justify for individual PMs or small teams doing discovery work.
- **Generic whiteboard templates** (Miro, Lucid) -- cheap or free, but they're just sticky notes on a canvas. No structure, no data model, no export.

I wanted something in between: a focused tool that makes it fast to capture a Feature > Epic > Story hierarchy, slice it by release, and then **export structured data** that can be imported into Jira or Azure DevOps. The goal isn't to replace a backlog tool -- it's to make the upstream discovery process faster and more useful.

## What It Does

- **Local-first** -- all data persists in your browser's IndexedDB. No account, no server, no internet connection required. Your maps survive browser restarts.
- **Three-level hierarchy** -- Features contain Epics, which contain Stories. Drag and drop at every level to reorder, reparent, or promote items.
- **Release slicing** -- Create named, colour-coded releases and assign stories to them. Horizontal dividers show which work ships when.
- **Drag-and-drop everywhere** -- Reorder features, move epics between features (child stories follow), drag stories across epics or releases.
- **Inline editing** -- Click any card to edit the title, description, and acceptance criteria.
- **Export to JSON, Jira, or Azure DevOps** -- Export a map as a portable JSON file (one file per map), or as a CSV ready for direct import into Jira or ADO.
- **Import** -- Re-import previously exported JSON maps.
- **Zoom controls** -- Zoom in, out, or fit-to-screen for large boards.
- **Pluggable storage** -- bring your own backend by implementing the `StorageAdapter` interface. A Supabase adapter is included for cloud sync.

## Quick Start

```bash
git clone https://github.com/STVPJ/story-mapper.git
cd story-mapper
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and create your first story map. That's it -- no environment variables, no database setup, no accounts.

## Export Formats

From the toolbar's **Export** dropdown you can download:


| Format               | Description                                                   | Use case                                         |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| **JSON**             | Full map data with all features, epics, stories, and releases | Backup, sharing, re-importing into StoryMapper   |
| **Jira CSV**         | Features as Epics, Epics as Stories, Stories as Sub-tasks     | Jira's built-in CSV import                       |
| **Azure DevOps CSV** | Features as Epics, Epics as Features, Stories as User Stories | ADO's CSV import with hierarchical Title columns |


## Architecture

### Storage Adapter Pattern

The persistence layer is abstracted behind a `StorageAdapter` interface (`src/lib/adapters/StorageAdapter.ts`). Two implementations ship out of the box:

- **LocalStorageAdapter** (default) -- stores each map as a single denormalised record in IndexedDB. Writes are debounced at 300ms. No configuration needed.
- **SupabaseAdapter** (optional) -- uses Supabase PostgreSQL with row-level security. Enable it by setting environment variables (see below).

The adapter is resolved at runtime: if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, the Supabase adapter loads; otherwise the local adapter is used. The Supabase SDK is only bundled when actually needed thanks to dynamic imports.

To add a custom backend (Firebase, a REST API, etc.), implement the `StorageAdapter` interface and update the factory in `src/lib/adapters/index.ts`.

### Where Your Maps Are Stored (Local Mode)

In the default local-only mode, maps live entirely in your browser's **IndexedDB** -- nothing leaves your machine and no account or server is involved:

- **Database:** `story-mapper` (version 1), **object store:** `maps`, keyed by each map's UUID.
- **Record shape:** one record per story map, holding the entire denormalised `StoryMap` object (all features, epics, stories, and releases nested inside). This keeps startup to a single read and each mutation to a single debounced write -- no joins or relational queries.
- **Persistence:** your maps survive browser restarts and offline use. Because the data is tied to that browser profile on that device, **Export to JSON** is the way to back up or move maps between machines.

**Resilience fallback:** IndexedDB can be unavailable or unresponsive -- private/incognito windows, blocked site storage, a second tab holding a version upgrade, or locked-down corporate browser policies (its nastiest failure mode is `open` or a transaction hanging with no event ever firing). Every IndexedDB step is bounded by a 3-second timeout. If any step fails or hangs, StoryMapper permanently switches to an **in-memory store** for the rest of the session and logs a single console warning. The app stays fully usable, but **data in this mode is not persisted** -- it will not survive a refresh or tab close, so export your work to JSON.

### Data Model

```
StoryMap
  +-- Feature (ordered left-to-right)
  |     +-- Epic (ordered left-to-right)
  |           +-- Story (ordered top-to-bottom, grouped by Release)
  +-- Release (named, colour-coded, ordered top-to-bottom)
```

### State Management

A single Zustand store (`src/store/useStoryMapStore.ts`) is the source of truth. All mutations are optimistic: the UI updates immediately, then the storage adapter syncs in the background. On failure, the state rolls back and a toast notification appears.

## Enabling Cloud Mode (Optional)

If you'd like multi-device sync with authentication, you can connect your own Supabase project:

1. Create a Supabase project at [supabase.com](https://supabase.com) and configure GitHub OAuth
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates all five data tables plus the access-control tables, with row-level security enabled on every table.
3. Seed the first admin by adding your email to the allowlist (the script ends with this snippet):

   ```sql
   insert into public.allowed_users (email) values ('you@example.com');
   ```

4. Copy `.env.example` to `.env.local` and fill in your project credentials:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Restart the dev server. The app will now use GitHub OAuth for authentication and Supabase for storage.

### Cloud Mode Authentication

When running with a Supabase backend, StoryMapper uses an invite-only access model:

1. **Sign in with GitHub** -- OAuth flow handled by Supabase.
2. **Allowlist check** -- the app checks whether the user's email exists in the `allowed_users` table.
3. **Access request** -- if not on the allowlist, the user can submit a request.
4. **Admin approval** -- authorised users can approve requests from the "Manage Access" panel.
5. **Row-Level Security** -- all data is scoped to `user_id = auth.uid()`. Users can only see their own maps.

## Security

Although StoryMapper defaults to local-only mode with no server component, the codebase has been designed with cloud deployment in mind from the start. Security measures are baked into every layer so that enabling the optional Supabase backend doesn't introduce gaps. Key highlights:

- **No network surface in local mode** -- the Supabase SDK is not loaded at all; the default build makes zero network requests
- **Strict input validation** -- all imported data is validated through Zod schemas with field length limits, array size caps, and format constraints before it enters the system
- **XSS protection** -- zero instances of `dangerouslySetInnerHTML`; all user content rendered as escaped React text nodes
- **Row-Level Security (cloud mode)** -- all five database tables enforce `auth.uid() = user_id` on every CRUD operation at the PostgreSQL level
- **Authentication hardening (cloud mode)** -- GitHub OAuth with PKCE, invite-only allowlist, no passwords stored
- **Cryptographic IDs** -- all entity identifiers generated via `crypto.randomUUID()`
- **No secrets in code** -- `.env.local` is gitignored; no service-role keys or signing secrets appear in the codebase
- **Minimal dependencies** -- no analytics, tracking, telemetry, or external CDN scripts

For the full security architecture, including the risk summary, database constraints, deployment headers, and export security, see **[SECURITY.md](SECURITY.md)**.

## Tech Stack


| Layer                | Technology                         |
| -------------------- | ---------------------------------- |
| Framework            | React 19 + TypeScript              |
| Build                | Vite                               |
| Styling              | Tailwind CSS v4                    |
| State                | Zustand (optimistic updates)       |
| Drag & Drop          | @dnd-kit/core + @dnd-kit/sortable  |
| Local Storage        | IndexedDB (browser-native)         |
| Cloud Storage (opt.) | Supabase (PostgreSQL + Auth + RLS) |
| Validation           | Zod                                |
| Icons                | Lucide React                       |
| Testing              | Vitest                             |


## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build (type-check + bundle)
npm run preview      # Preview production build locally
npm run test         # Run tests
npm run lint         # Lint with ESLint
npx tsc --noEmit     # Type-check only
```

## Licence

MIT