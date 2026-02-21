# StoryMapper

A lightweight story mapping tool for agile teams. Organise work into a visual board with a three-level hierarchy — Features, Epics, and Stories — sliced horizontally by release.

## Features

- **Three-level hierarchy** — Features contain Epics, which contain Stories. Drag and drop at every level to reorder, reparent, or promote items.
- **Release slicing** — Create named, colour-coded releases and assign stories to them. Horizontal dividers on the board show which work ships when.
- **Drag-and-drop** — Reorder features, move epics between features (child stories follow), and drag stories across epics or releases.
- **Inline editing** — Click any card to open a modal where you can edit the title, description, and acceptance criteria. Save with the button or press Enter.
- **Import / Export** — Export a story map to JSON and import it back later.
- **Zoom controls** — Zoom in, out, or fit-to-screen for large boards.
- **GitHub login** — Authenticate with GitHub via Supabase Auth. All data is scoped to your account with row-level security.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand (optimistic updates) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Auth & Database | Supabase (PostgreSQL + Auth + RLS) |
| Icons | Lucide React |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with GitHub OAuth configured

### Setup

```bash
git clone https://github.com/STVPJ/story-mapper.git
cd story-mapper
npm install
```

Create a `.env.local` file (see `.env.example`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview   # preview the production build locally
```

## License

MIT
