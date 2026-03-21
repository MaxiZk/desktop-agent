# Backend Skills Demo

A full-stack TypeScript application demonstrating backend skills integration with a React frontend and Express API server.

## Features

- **Windows App Launcher**: Open Calculator and Notepad
- **File Reader**: Read local text files with UTF-8 support
- **CSV Analyzer**: Parse CSV files with multiple delimiter support
- **Ollama AI Integration**: Generate AI responses using local Ollama service
- **Memory Storage**: Persist data as JSON

## Architecture

```
┌─────────────────┐
│  React Frontend │
│   (Port 5173)   │
└────────┬────────┘
         │ HTTP/Fetch
         ▼
┌─────────────────┐
│  Express API    │
│   (Port 3001)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend Modules │
│  - Skills       │
│  - AI           │
│  - Memory       │
└─────────────────┘
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Ollama (optional, for AI features) - [Install Ollama](https://ollama.ai)

## Installation

```bash
# Install dependencies
npm install
```

## Running the Application

### Option 1: Run Both Servers Together (Recommended)

```bash
npm run dev:all
```

This starts:
- Frontend dev server on http://localhost:5173
- API server on http://localhost:3001

### Option 2: Run Servers Separately

Terminal 1 - Frontend:
```bash
npm run dev
```

Terminal 2 - API Server:
```bash
npm run server
```

## Available Scripts

- `npm run dev` - Start Vite dev server (frontend only)
- `npm run server` - Start Express API server (backend only)
- `npm run dev:all` - Start both frontend and backend concurrently
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## API Endpoints

All endpoints are available at `http://localhost:3001/api`

### Windows Applications
- `POST /api/open/calculator` - Open Windows Calculator
- `POST /api/open/notepad` - Open Windows Notepad

### File Operations
- `POST /api/read-file` - Read a text file
  ```json
  { "filePath": "path/to/file.txt" }
  ```

- `POST /api/analyze-csv` - Analyze a CSV file
  ```json
  { "filePath": "path/to/file.csv" }
  ```

### AI Integration
- `POST /api/ollama` - Generate AI response
  ```json
  {
    "prompt": "Your prompt here",
    "model": "llama2",
    "stream": false
  }
  ```

### Memory Storage
- `POST /api/memory/save` - Save memory data
  ```json
  {
    "data": { "key": "value" },
    "filePath": "./memory.json"
  }
  ```

- `GET /api/memory/load?filePath=./memory.json` - Load memory data

## Project Structure

```
.
├── server/
│   └── index.ts          # Express API server
├── src/
│   ├── backend/
│   │   └── index.ts      # Backend service exports
│   ├── skills/
│   │   ├── open_windows_app.ts
│   │   ├── read_file.ts
│   │   └── analyze_csv.ts
│   ├── ai/
│   │   └── ollama_ai.ts
│   ├── memory/
│   │   └── local_memory.ts
│   ├── App.tsx           # React frontend
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## Development

The frontend uses Vite's proxy feature to forward `/api` requests to the Express server, avoiding CORS issues during development.

## Testing

Run the test suite:

```bash
npm test
```

Watch mode for development:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## Notes

- The Ollama AI feature requires Ollama to be running locally on port 11434
- Memory files are saved to `./memory.json` by default
- Windows app launcher features only work on Windows OS
- All backend modules use structured error handling (no thrown exceptions)

## License

MIT
