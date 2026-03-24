# Bugfix Requirements Document

## Introduction

The Electron application shows a black screen on Windows during startup because `electron/main.cjs` loads `localhost:5173` immediately in `createWindow()`, but the Vite dev server takes 2-3 seconds to start. Additionally, the window is configured with `show: false` but the `ready-to-show` event handler doesn't actually show the window, leaving it hidden even after content loads.

This bugfix implements a wait mechanism to ensure Vite is ready before loading the URL, and properly shows the window after content is loaded.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `createWindow()` is called THEN the system immediately calls `mainWindow.loadURL('http://localhost:5173')` without waiting for Vite to start

1.2 WHEN Vite dev server is still starting (takes 2-3 seconds) THEN the system displays a black screen to the user because no content is available at localhost:5173

1.3 WHEN the window's `ready-to-show` event fires THEN the system does nothing (empty handler), leaving the window hidden even after content loads

1.4 WHEN Vite fails to start or is unavailable THEN the system continues to show a black screen with no fallback mechanism

### Expected Behavior (Correct)

2.1 WHEN `createWindow()` is called THEN the system SHALL wait for Vite dev server to be ready before calling `mainWindow.loadURL()`

2.2 WHEN waiting for Vite to start THEN the system SHALL retry HTTP requests to localhost:5173 until Vite responds successfully or a timeout is reached

2.3 WHEN the window's `ready-to-show` event fires THEN the system SHALL call `mainWindow.show()` to display the window with loaded content

2.4 WHEN Vite fails to start within the timeout period THEN the system SHALL fall back to loading `dist/index.html` from the production build

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the BrowserWindow is created THEN the system SHALL CONTINUE TO use `show: false` in the options to prevent showing an empty window

3.2 WHEN global shortcuts are registered (Ctrl+Space, Ctrl+N, Ctrl+Shift+V) THEN the system SHALL CONTINUE TO function correctly for showing/hiding the window

3.3 WHEN the window is minimized or closed THEN the system SHALL CONTINUE TO hide to tray instead of actually closing

3.4 WHEN Ollama status checking occurs THEN the system SHALL CONTINUE TO check after 3 seconds and send status to renderer

3.5 WHEN backend and frontend processes are started THEN the system SHALL CONTINUE TO spawn them with the same configuration

3.6 WHEN the tray icon is clicked THEN the system SHALL CONTINUE TO toggle window visibility
