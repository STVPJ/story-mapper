# StoryMapper

A lightweight story mapping tool built to solve a real problem in product management: capturing and structuring requirements without paying for enterprise tooling you don't need.

**Note:** I'm a Product Manager, not a software engineer. I wrote the PRD and made all product decisions, but the code was written entirely by AI — [Claude Code](https://claude.ai/code) for development and Google Gemini for code review.

## Why I Built This

As a Product Manager, story mapping is one of the most effective techniques for breaking down requirements and planning releases. But the existing tools fall into two camps:

- **Enterprise platforms** (Avion, StoriesOnBoard, etc.) — powerful, but their subscription costs are hard to justify for individual PMs or small teams doing discovery work.
- **Generic whiteboard templates** (Miro, Lucid) — cheap or free, but they're just sticky notes on a canvas. No structure, no data model, no export.

I wanted something in between: a focused tool that makes it fast to capture a Feature → Epic → Story hierarchy, slice it by release, and then **export structured data** that can be fed into LLM-assisted workflows to generate Jira or Azure DevOps tickets. The goal isn't to replace a backlog tool — it's to make the upstream discovery process faster and more useful.

## What It Does

- **Three-level hierarchy** — Features contain Epics, which contain Stories. Drag and drop at every level to reorder, reparent, or promote items.
- **Release slicing** — Create named, colour-coded releases and assign stories to them. Horizontal dividers show which work ships when.
- **Drag-and-drop everywhere** — Reorder features, move epics between features (child stories follow), drag stories across epics or releases.
- **Inline editing** — Click any card to edit the title, description, and acceptance criteria.
- **Structured JSON export** — Export a story map to JSON that preserves the full hierarchy and release assignments, ready for LLM ingestion or scripted import into project management tools.
- **Import** — Re-import previously exported maps.
- **Zoom controls** — Zoom in, out, or fit-to-screen for large boards.
- **GitHub login** — Authenticate via GitHub OAuth. All data is scoped to your account with row-level security.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand (optimistic updates) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Auth & Database | Supabase (PostgreSQL + Auth + RLS) |
| Icons | Lucide React |
| Testing | Vitest |
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

### Tests

```bash
npm run test
```

## License

MIT
