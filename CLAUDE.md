# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project scope constraint

**Frontend UX/UI only.** Do not modify backend files (`server/`). All work is on the `client/` directory — styling, layout, responsiveness, and component presentation. The server (Fastify + Socket.IO on port 3001) is treated as a black box.

## Responsive design target

All UI must work across five breakpoint tiers:
1. **Mobile Portrait** (≤480px)
2. **Mobile Landscape & Small Tablet** (481–768px)
3. **Tablet Portrait & Landscape** (769–1024px)
4. **Laptop & Small Desktop** (1025–1440px)
5. **Desktop Monitor** (>1440px)

The existing codebase has a single `@media (max-width: 768px)` block in `global.css` and no other responsive handling — most pages are desktop-only today.

## What this app is

CeTeau AI — a self-hosted AI workspace with chat, multi-agent orchestration, file management, and skill auto-generation. Forked from [Sompote/tiger_cowork](https://github.com/Sompote/tiger_cowork). Version 0.6.0 / 0.7.1.

## Build & dev commands

```bash
# Install (root + client are separate npm projects)
npm install && cd client && npm install

# Dev — run both server and client
npm run dev              # server on :3001 (tsx watch)
cd client && npm run dev # Vite dev server on :5173 (proxies /api, /sandbox, /socket.io to :3001)

# Production build (client only)
npm run build            # runs: cd client && npx vite build

# Docker
docker compose up --build   # host :8080 → container :3001
```

No test suite exists. No linter is configured.

## Architecture

```
client/                      # React 18 + Vite 5 + TypeScript
  src/
    App.tsx                  # Routes: /, /chat/:id, /chats, /project, /project/:id,
                             #         /files, /tasks, /schedule, /skills, /settings
    components/
      layout/
        AppShell.tsx         # Top-level frame: sidebar + <Outlet>
        Sidebar.tsx          # Global left nav with drag-to-pin chats (@dnd-kit)
        ChatInputBar.tsx     # Message input with file attachments
        Toaster.tsx          # Global toast queue (notify.success/error/info/warning)
      AuthGate.tsx           # Token auth wrapper
      MessageBubble.tsx      # Chat message rendering (markdown, code blocks)
    pages/
      ChatPage.tsx           # Main chat UI (~71KB, largest file — Socket.IO streaming)
      ChatsPage.tsx          # Chat session list
      ProjectsPage.tsx       # Project list
      ProjectDetailPage.tsx  # Single project workspace
      FilesPage.tsx          # File browser
      TasksPage.tsx          # Task monitor (serves both /tasks and /schedule)
      SkillsPage.tsx         # Skill management + auto-skill approval
      SettingsPage.tsx       # Settings (accessible via URL only, hidden from sidebar)
    store/                   # Zustand stores
      theme.ts               # Binary light/dark, persisted to localStorage("ceteau:theme"),
                             #   applied via data-theme attr + .dark class on <html>
      conversations.ts       # Pinned chats (localStorage)
      projects.ts            # Project list (localStorage)
    hooks/useSocket.ts       # Socket.IO connection hook
    utils/api.ts             # Centralized fetch with Bearer token auth
    styles/global.css        # CSS reset, design tokens, utility classes (.btn-*)

server/                      # Fastify 5 + Socket.IO (DO NOT EDIT)
data/                        # JSON persistence (chat_history, tasks, settings, etc.)
Tiger_bot/                   # Bot skills (duckduckgo-search, email, reddit, word-docx)
```

## Styling system

**Dual approach: CSS custom properties + Tailwind 3.4 utilities.**

### Design tokens (source of truth: `client/src/styles/global.css`)

Every token has a hex form and a space-separated RGB form for Tailwind alpha support:

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` (cards) | #FFFFFF | #1E293B |
| `--bg-secondary` (canvas) | #F8F9FA | #0F172A |
| `--bg-tertiary` (hover) | #F1F5F9 | #243447 |
| `--accent` (CeTeau Blue) | #0073C2 | #008BE6 |
| `--text-primary` | #1A202C | #F8FAFC |
| `--text-secondary` | #64748B | #94A3B8 |
| `--border` | #E2E8F0 | #334155 |

Plus `--success`, `--warning`, `--error`, `--pill-*-bg|fg`, `--code-bg|fg`, `--shadow-sm|md|lg`, `--radius`, `--font-sans`, `--font-mono`, `--sidebar-width` (280px, 260px on mobile), `--header-height` (56px, 48px on mobile).

### Tailwind config (`client/tailwind.config.cjs`)

- **Preflight disabled** — existing CSS reset is preserved
- **Dark mode**: `["class", '[data-theme="dark"]']` — both `.dark` class and `data-theme` attribute work
- **Agentflow-compatible naming**:
  - Backgrounds: `bg-bg-base` (canvas), `bg-bg-surface` (cards), `bg-bg-sunken` (hover)
  - Text: `text-fg-base`, `text-fg-muted`, `text-fg-subtle`
  - Accent: `bg-accent`, `text-accent`, `bg-accent/10` (opacity modifiers work)
  - Borders: `border-border`, `border-border-base`
  - Semantic: `bg-success`, `text-error`, `border-warning` (with opacity)
  - Type scale: `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-sm`, `text-caption`

### Fonts

Google Sans → Noto Sans Thai → Roboto (sans), Roboto Mono / Fira Code (mono). Loaded from Google Fonts CDN in `client/index.html`.

### How to style new markup

1. Use Tailwind utilities from the mapped token set above (preferred for layout, spacing, responsive)
2. Use `var(--token)` via inline style for anything not in the compiled Tailwind set
3. Use existing `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-icon` classes for buttons
4. Dark mode is automatic — tokens flip via CSS custom properties when `data-theme="dark"` is set

## Layout pattern

`AppShell` = horizontal flex: `<Sidebar />` (fixed width `--sidebar-width`) + `<main>` (flex-1, scrollable). No top header bar — brand and nav live in the sidebar.

The sidebar currently has no mobile hamburger/drawer behavior — this is a gap to address for responsive work.

## Theme system

Zustand store at `store/theme.ts`. Toggle via `useThemeStore().toggle()`. Persisted to `localStorage("ceteau:theme")`. Applied as `<html data-theme="light|dark">` + `.dark`/`.light` class.

## Key libraries

- **zustand** — state management (no Redux)
- **@dnd-kit/core** — drag-and-drop (sidebar pin, agent editor)
- **socket.io-client** — real-time chat streaming
- **react-router-dom v6** — routing
- **lucide-react** — icons
- **react-markdown + remark-gfm + rehype-raw** — markdown rendering
- **react-syntax-highlighter** — code blocks
- **recharts** — charts
- **clsx** — conditional class names

## Environment

- `ACCESS_TOKEN` in `.env` — optional auth gate (empty = disabled)
- Vite dev proxy: `/api`, `/sandbox`, `/socket.io` → `http://localhost:3001`
- Docker exposes host:8080 → container:3001
