# Electron Vite Wait Fix Bugfix Design

## Overview

The Electron application displays a black screen on Windows during startup because it attempts to load the Vite dev server URL (localhost:5173) before Vite has finished starting. Additionally, the window is configured with `show: false` but the `ready-to-show` event handler is empty, leaving the window hidden even after content loads.

This bugfix implements a retry-based wait mechanism (`waitForVite()`) that polls the Vite dev server until it's ready, modifies `createWindow()` to use this wait mechanism before loading the URL, adds a fallback to load the production build if Vite fails to start, and properly shows the window in the `ready-to-show` event handler.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when `createWindow()` attempts to load localhost:5173 before Vite dev server is ready
- **Property (P)**: The desired behavior - the window should wait for Vite to be ready before loading, then show the window with content
- **Preservation**: Existing functionality (global shortcuts, tray behavior, process spawning, Ollama checking) that must remain unchanged
- **waitForVite()**: A new async function that retries HTTP requests to localhost:5173 until Vite responds or timeout is reached
- **createWindow()**: The function in `electron/main.cjs` that creates the BrowserWindow and loads the application UI
- **ready-to-show**: The BrowserWindow event that fires when the page has finished loading and is ready to be displayed

## Bug Details

### Bug Condition

The bug manifests when the Electron application starts and `createWindow()` is called. The function immediately calls `mainWindow.loadURL('http://localhost:5173')` without waiting for the Vite dev server to start, which takes 2-3 seconds. Additionally, the `ready-to-show` event handler is empty, so even when content eventually loads, the window remains hidden.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { viteStartTime: number, loadURLCallTime: number, readyToShowHandlerEmpty: boolean }
  OUTPUT: boolean
  
  RETURN (input.loadURLCallTime < input.viteStartTime)
         AND (input.viteStartTime - input.loadURLCallTime > 0)
         AND input.readyToShowHandlerEmpty
END FUNCTION
```

### Examples

- **Example 1**: User starts the Electron app → `createWindow()` calls `loadURL('http://localhost:5173')` at t=0ms → Vite dev server starts at t=2500ms → User sees black screen for 2.5 seconds, then window remains hidden
- **Example 2**: User starts the Electron app → `createWindow()` calls `loadURL()` at t=0ms → Vite dev server starts at t=3000ms → User sees black screen for 3 seconds, then window remains hidden
- **Example 3**: User starts the Electron app → Vite fails to start → User sees black screen indefinitely with no fallback
- **Edge case**: Vite starts very quickly (t=100ms) → Race condition may still occur if `loadURL()` is called before Vite is ready

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- BrowserWindow creation with `show: false` option must continue to prevent showing an empty window
- Global shortcuts (Ctrl+Space, Ctrl+N, Ctrl+Shift+V) must continue to function correctly
- Window minimize/close behavior (hide to tray) must remain unchanged
- Ollama status checking after 3 seconds must continue to work
- Backend and frontend process spawning must continue with the same configuration
- Tray icon click behavior (toggle window visibility) must remain unchanged

**Scope:**
All functionality that does NOT involve the initial window loading sequence should be completely unaffected by this fix. This includes:
- Tray menu interactions
- Global shortcut handling
- IPC handlers (speak, speak-stop)
- Process lifecycle management (backend, frontend, Ollama)
- Window visibility toggling after initial load

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Race Condition**: The `createWindow()` function calls `mainWindow.loadURL('http://localhost:5173')` synchronously without waiting for the Vite dev server to start
   - Vite dev server is spawned in `startProcesses()` but takes 2-3 seconds to become available
   - No retry or wait mechanism exists to ensure Vite is ready

2. **Missing Window Show Logic**: The `ready-to-show` event handler is empty
   - Even when content eventually loads, the window remains hidden because `show: false` is set
   - No call to `mainWindow.show()` exists in the handler

3. **No Fallback Mechanism**: If Vite fails to start or is unavailable, there's no fallback to load the production build
   - User is left with a black screen indefinitely
   - No error handling or alternative loading strategy

4. **Timing Dependency**: The current implementation assumes Vite will be available immediately, which is not guaranteed
   - No timeout or retry logic
   - No status checking before attempting to load

## Correctness Properties

Property 1: Bug Condition - Vite Wait Before Load

_For any_ application startup where `createWindow()` is called, the fixed function SHALL wait for the Vite dev server to respond successfully at localhost:5173 before calling `mainWindow.loadURL()`, and SHALL call `mainWindow.show()` in the `ready-to-show` event handler to display the window with loaded content.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing Functionality Unchanged

_For any_ functionality that does NOT involve the initial window loading sequence (global shortcuts, tray behavior, process spawning, Ollama checking, IPC handlers), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing interactions and event handling.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `electron/main.cjs`

**Function**: `createWindow()` and new `waitForVite()`

**Specific Changes**:
1. **Add waitForVite() function**: Create a new async function that retries HTTP requests to localhost:5173
   - Use Node.js `http` module to make GET requests
   - Implement retry logic with configurable timeout (default 30 seconds)
   - Return true if Vite responds, false if timeout is reached
   - Log retry attempts for debugging

2. **Modify createWindow() to be async**: Change function signature to `async function createWindow()`
   - Call `await waitForVite()` before `mainWindow.loadURL()`
   - If `waitForVite()` returns false, fall back to loading `dist/index.html`
   - Log whether Vite or fallback is being used

3. **Update ready-to-show handler**: Add `mainWindow.show()` call in the event handler
   - Remove the comment about starting minimized to tray
   - Actually show the window when content is ready

4. **Update app.whenReady() call**: Change `createWindow()` call to `await createWindow()`
   - Wrap in async function or use `.then()` to handle the promise
   - Ensure proper error handling

5. **Add error handling**: Wrap HTTP requests in try-catch blocks
   - Handle connection refused errors gracefully
   - Log errors for debugging without crashing the app

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the application startup sequence and measure the timing between `loadURL()` call and Vite availability. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Immediate Load Test**: Start app and measure time until `loadURL()` is called (will show it's called immediately on unfixed code)
2. **Vite Availability Test**: Start app and measure time until Vite responds at localhost:5173 (will show 2-3 second delay on unfixed code)
3. **Window Visibility Test**: Start app and check if window is visible after content loads (will fail on unfixed code - window stays hidden)
4. **Race Condition Test**: Start app multiple times and verify black screen occurs consistently (will fail on unfixed code)

**Expected Counterexamples**:
- `loadURL()` is called at t=0ms while Vite becomes available at t=2000-3000ms
- Window remains hidden even after `ready-to-show` event fires
- Possible causes: no wait mechanism, empty event handler, race condition

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := createWindow_fixed()
  ASSERT waitForVite() was called before loadURL()
  ASSERT window.show() was called in ready-to-show handler
  ASSERT window is visible after content loads
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT createWindow_original(input) = createWindow_fixed(input)
  ASSERT all other functionality remains unchanged
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for global shortcuts, tray interactions, and process management, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Global Shortcuts Preservation**: Observe that Ctrl+Space, Ctrl+N, Ctrl+Shift+V work on unfixed code, then verify they continue working after fix
2. **Tray Behavior Preservation**: Observe that tray click toggles window visibility on unfixed code, then verify this continues after fix
3. **Process Spawning Preservation**: Observe that backend/frontend processes start correctly on unfixed code, then verify this continues after fix
4. **Ollama Checking Preservation**: Observe that Ollama status is checked after 3 seconds on unfixed code, then verify this continues after fix

### Unit Tests

- Test `waitForVite()` function with mock HTTP server (success case, timeout case, connection refused case)
- Test `createWindow()` calls `waitForVite()` before `loadURL()`
- Test `ready-to-show` handler calls `mainWindow.show()`
- Test fallback to `dist/index.html` when Vite is unavailable

### Property-Based Tests

- Generate random startup timing scenarios and verify window loads correctly
- Generate random Vite availability patterns and verify wait mechanism handles them
- Test that all non-loading functionality continues to work across many scenarios

### Integration Tests

- Test full application startup with Vite dev server running
- Test full application startup with Vite unavailable (fallback scenario)
- Test that window becomes visible after content loads
- Test that global shortcuts work after window is shown
