# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Vite Wait Before Load
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that `createWindow()` waits for Vite dev server to be ready before calling `loadURL()`
  - Test that `ready-to-show` event handler calls `mainWindow.show()` to display the window
  - Verify window becomes visible after content loads (not hidden with black screen)
  - The test assertions should match the Expected Behavior Properties from design:
    - `waitForVite()` is called before `loadURL()`
    - `mainWindow.show()` is called in `ready-to-show` handler
    - Window is visible after content loads
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - `loadURL()` called at t=0ms while Vite available at t=2000-3000ms
    - Window remains hidden even after `ready-to-show` fires
    - Black screen displayed to user during startup
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (functionality not involving initial window loading)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Global shortcuts (Ctrl+Space, Ctrl+N, Ctrl+Shift+V) function correctly
    - Window minimize/close behavior (hide to tray) works as expected
    - Tray icon click toggles window visibility
    - Ollama status checking occurs after 3 seconds
    - Backend and frontend processes spawn correctly
    - IPC handlers (speak, speak-stop) work correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for Electron Vite wait mechanism

  - [x] 3.1 Implement waitForVite() function
    - Create async function that retries HTTP requests to localhost:5173
    - Use Node.js `http` module to make GET requests
    - Implement retry logic with configurable timeout (default 30 seconds)
    - Return true if Vite responds, false if timeout is reached
    - Log retry attempts for debugging
    - Add error handling with try-catch blocks
    - Handle connection refused errors gracefully
    - _Bug_Condition: isBugCondition(input) where input.loadURLCallTime < input.viteStartTime_
    - _Expected_Behavior: waitForVite() returns true when Vite is ready, false on timeout_
    - _Preservation: Does not affect existing functionality (global shortcuts, tray, processes)_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Modify createWindow() to use waitForVite
    - Change function signature to `async function createWindow()`
    - Call `await waitForVite()` before `mainWindow.loadURL()`
    - If `waitForVite()` returns false, fall back to loading `dist/index.html`
    - Log whether Vite or fallback is being used
    - _Bug_Condition: isBugCondition(input) where loadURL called before Vite ready_
    - _Expected_Behavior: createWindow() waits for Vite before loading URL_
    - _Preservation: BrowserWindow creation with show: false remains unchanged_
    - _Requirements: 2.1, 2.4, 3.1_

  - [x] 3.3 Update ready-to-show handler to show window
    - Add `mainWindow.show()` call in the `ready-to-show` event handler
    - Remove comment about starting minimized to tray
    - Actually show the window when content is ready
    - _Bug_Condition: isBugCondition(input) where readyToShowHandlerEmpty is true_
    - _Expected_Behavior: Window becomes visible after content loads_
    - _Preservation: Window minimize/close behavior remains unchanged_
    - _Requirements: 2.3, 3.1_

  - [x] 3.4 Update app.whenReady() to await createWindow
    - Change `createWindow()` call to `await createWindow()` or use `.then()`
    - Wrap in async function to handle the promise
    - Ensure proper error handling
    - _Bug_Condition: isBugCondition(input) where createWindow called synchronously_
    - _Expected_Behavior: app.whenReady() properly awaits window creation_
    - _Preservation: Process spawning and Ollama startup remain unchanged_
    - _Requirements: 2.1, 3.4, 3.5_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Vite Wait Before Load
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify `waitForVite()` is called before `loadURL()`
    - Verify `mainWindow.show()` is called in `ready-to-show` handler
    - Verify window is visible after content loads
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Verify global shortcuts, tray behavior, process spawning, Ollama checking all work correctly
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
