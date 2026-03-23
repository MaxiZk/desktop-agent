# Desktop Agent — JARVIS-like AI Assistant

A fully functional JARVIS-like AI Desktop Agent built with Electron, React, TypeScript and Ollama. Talk to your desktop: open apps, launch games, manage files, edit documents, control your system — all through natural language.

## Features

### 🤖 AI Chat
- Full conversational interface powered by local **Ollama** LLM
- Message history with skill metadata badges
- Typing indicator and real-time feedback
- Falls back gracefully when Ollama is unavailable

### ⚙️ Application Launcher
- Open any installed app by name: `abrí chrome`, `open vscode`
- Close, focus, minimize running apps: `cerrá notepad`, `enfocá discord`
- App discovery via `config/apps.json` registry + system PATH lookup
- Supports Windows, Linux and macOS

### 🎮 Game Launcher *(new)*
- Launch Steam games by name or alias: `jugá minecraft`, `play cs2`
- Full game library catalog in `config/games.json`
- List available games: `lista juegos`
- Direct Steam client: `abrí steam`
- Falls back to Steam search for unknown games

### 📁 File Manager
- Search for files: `buscá ventas.xlsx`
- Read file contents: `leé config.txt`
- Open files with default app: `abrí archivo informe.pdf`
- Open containing folder: `abrí carpeta src`

### 📦 Archive Support *(new)*
- List archive contents: `listá backup.zip`
- Extract archives: `extraé backup.zip`, `extract archive.tar.gz to /tmp/out`
- Create zip archives: `zip docs/ to backup.zip`
- Supports `.zip`, `.tar`, `.tar.gz`, `.tar.bz2`, `.rar`

### 📊 Excel / CSV Operations
- Read and summarize Excel files: `leé excel ventas.xlsx`
- Monthly summary: `resumen mensual de ventas.xlsx`
- Find duplicates: `duplicados por email en clientes.xlsx`
- Convert CSV to Excel: `convertí datos.csv a excel`

### ✏️ Text Editing
- Append text: `agregá al final de notas.txt: reunión el lunes`
- Replace text: `reemplazá "viejo" por "nuevo" en archivo.txt`
- Delete lines: `eliminá la línea "borrar esto" de notas.txt`

### 🔒 System Controls
- Lock screen: `bloqueá la PC`
- Shutdown / Restart / Sleep (with confirmation): `apagá la PC`

### 🧠 Memory System
- Persistent conversation memory in `memory.json`
- Command history with timestamps
- View history: `historial`

---

## Architecture

```
┌────────────────────────────────────┐
│         Electron Desktop App        │
│  ┌──────────────┐  ┌─────────────┐ │
│  │  React UI    │  │  Main proc  │ │
│  │  (Port 5173) │  │  Tray/Tbar  │ │
│  └──────┬───────┘  └──────┬──────┘ │
└─────────│─────────────────│────────┘
          │ HTTP/Fetch       │ IPC
          ▼                  ▼
┌─────────────────────────────────────┐
│        Express API  (Port 3001)      │
│  POST /api/command  ←── NLP router  │
└──────────────┬──────────────────────┘
               │
         ┌─────▼──────┐
         │SkillRegistry│
         └─────┬──────┘
    ┌──────────┼─────────────────────┐
    ▼          ▼          ▼          ▼
 AppSkill  FileSkill  GameSkill  ExcelSkill
    ▼          ▼          ▼          ▼
 SystemSkill TextEditSkill  ...  OllamaAI
```

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** or yarn
- **Ollama** (optional, for AI chat features) — [Install Ollama](https://ollama.ai)
  - Pull a model: `ollama pull llama3.2:1b`

---

## Installation

```bash
# Clone and install dependencies
npm install
```

---

## Running the Application

### Option 1: Full Desktop App (Electron)

```bash
npm run desktop
```

This opens the Electron window with tray integration. The app starts frontend + backend automatically.

### Option 2: Development Mode (browser)

```bash
# Terminal 1 — Frontend dev server (http://localhost:5173)
npm run dev

# Terminal 2 — API server (http://localhost:3001)
npm run server
```

### Option 3: Run Both at Once

```bash
npm run dev:all
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run server` | Start Express API server (backend only) |
| `npm run dev:all` | Start both frontend and backend concurrently |
| `npm run desktop` | Launch the Electron desktop app |
| `npm run build` | Build for production |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## Command Examples

### Chat & AI
```
Hola, ¿cómo estás?
¿Qué puedes hacer?
ayuda
```

### Apps
```
abrí chrome
abrí vscode
cerrá notepad
minimizá discord
listar apps abiertas
```

### Games 🎮
```
jugá minecraft
play cs2
lanzá dota2
lista juegos
abrí steam
```

### Files & Archives
```
buscá ventas.xlsx
leé config.txt
abrí carpeta src
listá backup.zip
extraé backup.zip
extraé archive.tar.gz a /tmp/salida
```

### Excel
```
leé excel ventas.xlsx
resumen mensual de ventas.xlsx
duplicados por email en clientes.xlsx
convertí datos.csv a excel
```

### Text Editing
```
agregá al final de notas.txt: reunión el lunes
reemplazá "viejo" por "nuevo" en archivo.txt
eliminá la línea "borrar esto" de notas.txt
```

### System
```
bloqueá la PC
apagá la PC
reiniciá la PC
historial
```

---

## Configuration

### App Registry — `config/apps.json`

Add custom apps with their launch commands or URLs:

```json
{
  "apps": {
    "myapp": {
      "type": "command",
      "value": "start \"\" myapp.exe",
      "aliases": ["mi app", "myapplication"]
    }
  }
}
```

### Game Library — `config/games.json`

Add games with their Steam App IDs or launch URLs:

```json
{
  "games": {
    "my_game": {
      "launcher": "steam",
      "steamAppId": "12345",
      "value": "steam://rungameid/12345",
      "aliases": ["my game", "mygame"],
      "category": "action"
    }
  }
}
```

---

## API Reference

All endpoints available at `http://localhost:3001/api`

### Unified Command Endpoint (Recommended)
```
POST /api/command
{ "text": "jugá minecraft" }
```

### App Control
```
POST /api/open-app      { "appName": "chrome" }
POST /api/apps/close    { "appName": "notepad" }
POST /api/apps/focus    { "appName": "vscode" }
POST /api/apps/minimize { "appName": "discord" }
GET  /api/apps/running
```

### File Operations
```
POST /api/search-files   { "query": "ventas.xlsx" }
POST /api/read-file-path { "path": "file.txt" }
POST /api/open-file      { "path": "file.pdf" }
POST /api/open-folder    { "path": "src/" }
```

### Archive Operations
```
POST /api/archive/list    { "archivePath": "backup.zip" }
POST /api/archive/extract { "archivePath": "backup.zip", "destPath": "/tmp/out" }
POST /api/archive/create  { "outputPath": "out.zip", "sourcePaths": ["src/"] }
```

### Excel Operations
```
POST /api/excel/read  { "filePath": "ventas.xlsx" }
POST /api/excel/write { "filePath": "out.xlsx", "data": [...] }
```

### System Control
```
POST /api/system/lock
POST /api/system/shutdown
POST /api/system/restart
POST /api/system/sleep
POST /api/system/confirm { "action": "shutdown" }
```

### AI & Memory
```
POST /api/ollama        { "prompt": "...", "model": "llama3.2:1b" }
POST /api/memory/save   { "data": {...} }
GET  /api/memory/load
GET  /api/command-history
```

---

## Project Structure

```
desktop-agent/
├── electron/
│   ├── main.cjs          # Electron main process (tray, shortcut, Ollama)
│   └── preload.cjs       # IPC bridge renderer ↔ main
├── server/
│   └── index.ts          # Express API server + unified /api/command
├── src/
│   ├── App.tsx           # React chat UI
│   ├── App.css           # Dark theme styles
│   ├── skills/
│   │   ├── CommandRouter.ts    # NLP intent parser (ES + EN)
│   │   ├── SkillRegistry.ts    # Skill dispatcher
│   │   ├── RiskGuard.ts        # Confirmation for destructive actions
│   │   ├── Skill.ts            # Interfaces
│   │   ├── archive_operations.ts  # zip/tar/rar handling
│   │   ├── impl/
│   │   │   ├── AppSkill.ts     # App launcher/manager
│   │   │   ├── FileSkill.ts    # File operations + archives
│   │   │   ├── GameSkill.ts    # Game launcher 🎮
│   │   │   ├── ExcelSkill.ts   # Excel/CSV operations
│   │   │   ├── SystemSkill.ts  # System controls
│   │   │   └── TextEditSkill.ts # Text file editor
│   │   └── utils/
│   │       ├── AppFinder.ts    # Cross-platform app discovery
│   │       ├── FreeFormHandler.ts  # Ollama free-form fallback
│   │       └── NarratorService.ts  # Ollama response narrator
│   ├── ai/
│   │   └── ollama_ai.ts       # Ollama API client
│   ├── memory/
│   │   └── local_memory.ts    # JSON persistence
│   └── backend/
│       └── index.ts           # Central re-export module
├── config/
│   ├── apps.json              # App registry
│   └── games.json             # Game library 🎮
└── memory.json                # Persistent memory store
```

---

## Keyboard Shortcut

- **Ctrl+Space** (or **Cmd+Space** on macOS) — Show/hide the agent window from anywhere

---

## Notes

- Ollama AI requires the service running locally on port 11434
- Game launching uses Steam URL protocol (`steam://rungameid/...`) — Steam must be installed for Steam games
- Archive operations require `unzip`/`zip`/`tar` on Linux, PowerShell on Windows
- System controls (shutdown, restart, sleep) require user confirmation
- All backend modules use structured error handling (no thrown exceptions)

## License

MIT

