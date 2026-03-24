# Bug Condition Exploration - Counterexamples

## Test Run: Vite Wait Before Load Bug

**Date**: Task 1 Execution  
**Status**: ✅ Test FAILED as expected (confirms bug exists)  
**Test File**: `electron/__tests__/vite-wait.bugfix.property.test.ts`

## Counterexamples Found

### 1. Missing `waitForVite()` Function
**Test**: `BUGFIX EXPLORATION: waitForVite() function should exist in main.cjs`  
**Result**: FAILED ❌  
**Finding**: The `waitForVite()` function does not exist in `electron/main.cjs`

**Evidence**:
- Searched for: `function waitForVite`, `const waitForVite`, `async function waitForVite`
- Found: None
- Conclusion: No wait mechanism exists to ensure Vite is ready before loading

### 2. `createWindow()` Not Async
**Test**: `BUGFIX EXPLORATION: createWindow() should be async and call waitForVite()`  
**Result**: FAILED ❌  
**Finding**: `createWindow()` is not an async function and doesn't call `waitForVite()`

**Evidence**:
- `createWindowIsAsync`: false
- `callsWaitForVite`: false
- Conclusion: `createWindow()` calls `loadURL()` synchronously without waiting

### 3. Empty `ready-to-show` Handler
**Test**: `BUGFIX EXPLORATION: ready-to-show handler should call mainWindow.show()`  
**Result**: FAILED ❌  
**Finding**: The `ready-to-show` event handler is empty and doesn't call `mainWindow.show()`

**Evidence**:
```javascript
mainWindow.once("ready-to-show", () => {
  // Start minimized to tray - don't show on first launch
  // User can open via tray click or Ctrl+Space
});
```
- Handler body: (empty - only comments)
- `callsShow`: false
- Conclusion: Window remains hidden even after content loads

### 4. Race Condition: `loadURL()` Called Immediately
**Test**: `BUGFIX EXPLORATION: loadURL should be called after waitForVite`  
**Result**: FAILED ❌  
**Finding**: `loadURL()` is called immediately without waiting for Vite

**Evidence**:
- `waitForVitePos`: -1 (not found)
- `loadURLPos`: found in `createWindow()`
- Conclusion: `loadURL()` is called at t=0ms while Vite takes 2-3 seconds to start

### 5. Property Test: Concrete Failing Case
**Test**: `PROPERTY TEST: scoped to concrete failing case - immediate loadURL with 2-3s Vite delay`  
**Result**: FAILED ❌  
**Counterexample**: `[2000]` (Vite start time: 2000ms)

**Bug Condition**:
- `loadURLCallTime`: 0ms (immediate)
- `viteStartTime`: 2000ms (2 seconds delay)
- `readyToShowHandlerEmpty`: true
- **Delay**: 2000ms between loadURL and Vite ready

**Evidence**:
- `hasWaitForVite`: false
- `hasShowCall`: true (but in wrong place - not in ready-to-show handler)
- Conclusion: Race condition confirmed - loadURL called 2 seconds before Vite is ready

## Root Cause Analysis

**Summary**: The application displays a black screen during startup due to:

1. **Race Condition**: `createWindow()` calls `mainWindow.loadURL('http://localhost:5173')` immediately at t=0ms, but Vite dev server takes 2-3 seconds to start
2. **Missing Wait Mechanism**: No `waitForVite()` function exists to retry HTTP requests until Vite is ready
3. **Empty Event Handler**: The `ready-to-show` event handler is empty and doesn't call `mainWindow.show()`, leaving the window hidden even after content eventually loads

**User Experience**:
- User starts the Electron app
- Black screen appears for 2-3 seconds (waiting for Vite)
- Window remains hidden even after content loads
- User must manually click tray icon or use Ctrl+Space to show window

## Expected Behavior (After Fix)

1. **Add `waitForVite()` function**: Retry HTTP requests to localhost:5173 until Vite responds or timeout
2. **Make `createWindow()` async**: Call `await waitForVite()` before `mainWindow.loadURL()`
3. **Update `ready-to-show` handler**: Call `mainWindow.show()` to display the window with loaded content
4. **Add fallback**: Load `dist/index.html` if Vite fails to start within timeout

## Test Results Summary

- **Total Tests**: 9
- **Passed**: 3 (bug condition detection logic tests)
- **Failed**: 6 (bug exploration tests - expected to fail on unfixed code)

**Conclusion**: ✅ Bug confirmed - test failures prove the bug exists and identify the root cause
