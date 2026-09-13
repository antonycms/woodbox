<div align="center">

<img src="build/icon.png" alt="Woodbox Logo" width="120" />

# Woodbox

**Lightweight desktop database manager for PostgreSQL, MySQL and SQLite**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Windows](https://img.shields.io/badge/Windows-0078D4?logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](https://www.linux.org)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](https://www.apple.com/macos)

[Download](https://github.com/antonycms/woodbox/releases) · [Screenshots](screenshots) · [Report Bug](https://github.com/antonycms/woodbox/issues) · [Request Feature](https://github.com/antonycms/woodbox/issues)

</div>

---

## About

Woodbox is a desktop application for managing database connections and executing SQL queries. Organize your connections into projects, explore schemas, browse table data, and run custom queries — all from a clean, focused interface.

|  |  |
|---|---|
| ![Table data](screenshots/2.table_data.png) | ![Query editor with AI panel](screenshots/6.query_editor_with_ai_panel.png) |
| ![Table properties columns](screenshots/7.table_properties_columns.png) | ![Floating search](screenshots/4.float_search.png) |

[View all screenshots](screenshots)

## Why Woodbox?

- **Focused desktop workflow** — Manage projects, connections, schemas, tables and queries without leaving the app.
- **SQL-first experience** — Monaco-powered editor with autocomplete, selected-query execution, snippets and query results.
- **AI-assisted querying** — Generate, explain and refine SQL with your configured provider.
- **Local-first storage** — Connections, projects, scripts, snippets and preferences are saved locally.
- **Cross-platform** — Built with Electron for Windows, macOS and Linux.

## Highlights

### Browse table data

Inspect rows, paginate results, search data and explore table structure from a focused grid interface.

### Query editor

Write SQL with syntax highlighting, autocomplete, snippets, split tabs and keyboard-driven execution.

### AI assistant

Configure AI providers and use the assistant beside the editor to draft SQL, inspect context and review query execution.

### Schema tools

Explore tables, columns, indexes, foreign keys, functions and database structure, with database comparison support.

## Supported databases

| Database | Status |
|---|---|
| PostgreSQL | Supported |
| MySQL | Supported |
| SQLite | Supported |

## AI providers

| Provider | Status |
|---|---|
| OpenAI | Supported |
| Anthropic | Supported |
| Google | Supported |
| OpenRouter | Supported |
| OpenAI-compatible endpoints | Supported |
| Codex / ChatGPT account | Supported |

## Features

- **Multi-database support** — Connect to PostgreSQL, MySQL, and SQLite
- **Project organization** — Group connections into projects for easy access
- **Schema browser** — Explore database structure, tables, columns, and foreign keys
- **Table explorer** — Browse and paginate table data
- **SQL editor** — Write and execute queries with syntax highlighting and autocomplete (Monaco Editor)
- **AI assistant** — Use configured providers to generate, explain and refine SQL
- **Snippets** — Create, import and export reusable SQL snippets
- **Query results** — View results in a rich tabular format
- **Database compare** — Compare database structures across connections
- **Persistent storage** — Connections and projects are saved locally
- **Theme support** — Switch between dark and light themes
- **Cross-platform** — Runs on Windows, macOS, and Linux

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl/Cmd</kbd> + <kbd>Enter</kbd> | Run current SQL |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> | Run current SQL in a new result tab |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd> | Run selected SQL |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> | Run all SQL |
| <kbd>Ctrl/Cmd</kbd> + <kbd>E</kbd> | Explain current SQL |
| <kbd>Ctrl/Cmd</kbd> + <kbd>\</kbd> | Run current SQL in a new result tab |
| <kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd> | Open central search |

## Download

Download the latest installer from the [Releases](https://github.com/antonycms/woodbox/releases) page.

## Roadmap

- SSH tunnel support
- More database engines
- Query history improvements
- Import/export connection profiles
- Packaged installers for more distribution channels

## Tech Stack

| Category | Technology |
|---|---|
| Desktop | Electron 43 |
| Frontend | React 19, TypeScript 7 |
| Build | electron-vite, Vite 8 |
| Editor | Monaco Editor |
| Database | Knex, pg, mysql2, sqlite3 |
| Storage | electron-store |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- pnpm

### Installation

```bash
git clone https://github.com/antonycms/woodbox.git
cd woodbox
pnpm install
```

### Running

```bash
# Development (with hot reload)
pnpm run dev

# Preview production build
pnpm start
```

### Building

```bash
# Build for current platform
pnpm run build

# Platform-specific builds
pnpm run build:win    # Windows
pnpm run build:mac    # macOS
pnpm run build:linux  # Linux
```

## macOS: first launch warning

The macOS build is not notarized by Apple yet because Apple requires a paid Apple Developer Program account to create a Developer ID certificate and notarize apps distributed outside the Mac App Store. Because of that, Gatekeeper may block the first launch after installation.

This is expected and only needs to be done once after installing the app:

```bash
xattr -dr com.apple.quarantine /Applications/Woodbox.app
open /Applications/Woodbox.app
```

After the first successful launch, Woodbox can be opened normally from Applications.

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── database/       # DB connections and query logic
│   └── storage/        # Persistent storage (projects, connections)
├── preload/            # IPC bridge
└── renderer/           # React frontend
    └── src/
        ├── components/ # Reusable UI components
        ├── contexts/   # Global state (store, theme, tabs, toast)
        ├── views/      # Main views (TableInfo, QueryEditor)
        ├── hooks/      # Custom React hooks
        └── styles/     # Global styles and themes
```

## Scripts

| Script | Description |
|---|---|
| `pnpm run dev` | Start in development mode |
| `pnpm run build` | Build with TypeScript checks |
| `pnpm run typecheck` | Run TypeScript type checks |
| `pnpm run lint` | Lint and auto-fix with Biome |
| `pnpm run format` | Format code with Biome |

## License

[MIT](LICENSE) © [Antony Santos](https://github.com/antonycms)
