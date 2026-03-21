# Electron Linux Fixes Bugfix Design

## Overview

The Electron application in `electron/main.cjs` contains three critical Linux compatibility bugs that prevent cross-platform operation. The bugs stem from Windows-specific assumptions: using .ico icon format (unsupported on Linux), spawning processes with cmd.exe (Windows-only), and inadequate error handling for optional dependencies like Ollama. The fix will introduce platform detection and conditional logic to use appropriate commands and resources for each operating system, ensuring the application runs seamlessly on Windows, Linux, and macOS.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bugs - when the application runs on Linux (or macOS for icon issue)
- **Property (P)**: The desired behavior - application starts successfully with platform-appropriate icon, process spawning, and graceful error handling
- **Preservation**: Existing Windows functionality that must remain unchanged - .ico icons, cmd.exe process spawning, tray behavior, shortcuts
- **nativeImage**: Electron's cross-platform image API that can create empty images or load from files
- **spawn**: Node.js child_process method for launching new processes
- **process.platform**: Node.js property that returns 'win32', 'linux', or 'darwin' for platform detection

## Bug Details

### Bug Condition

The bugs manifest when the application runs on a non-Windows platform (Linux or macOS). Three distinct issues occur:

1. **Icon Loading Failure**: The Tray constructor receives an .ico file path, which is not supported on Linux/macOS, causing the tray icon to fail loading
2. **Process Spawning Failure**: The spawn() calls use 'cmd.exe' which does not exist on Linux/macOS, causing ENOENT errors and application crash
3. **Ollama Error Handling**: The spawn() call for Ollama lacks proper error handling, causing unhandled errors when Ollama is not installed

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { platform: string, operation: string }
  OUTPUT: boolean
  
  RETURN (input.platform IN ['linux', 'darwin'] AND input.operation == 'loadIcon')
         OR (input.platform IN ['linux', 'darwin'] AND input.operation == 'spawnProcess')
         OR (input.operation == 'startOllama' AND ollamaNotInstalled())
END FUNCTION
```

### Examples

- **Bug 1 - Icon**: On Linux, `new Tray(iconPath)` where iconPath = 'icon.ico' fails to load, tray icon appears broken or missing
- **Bug 2 - Process Spawning**: On Linux, `spawn("cmd.exe", ["/c", "npm", "run", "dev"])` throws "spawn cmd.exe ENOENT" and crashes the application
- **Bug 3 - Ollama Error**: On any platform, when Ollama is not installed, `spawn('ollama', ['serve'])` emits an error event that is caught but the process reference remains, potentially causing issues
- **Edge Case**: On macOS, the same bugs occur (icon format, no cmd.exe) but the application should work correctly after the fix

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Windows users must continue to see the .ico icon in both tray and window
- Windows process spawning must continue to use cmd.exe with /c flag
- Tray menu functionality (show/hide, start with Windows, quit) must remain identical
- Global shortcut Ctrl+Space (CommandOrControl+Space) must continue to work
- Ollama detection logic (checking if already running) must remain unchanged
- Window behavior (minimize to tray, close to tray, show/hide) must remain identical
- Backend and frontend process lifecycle management must remain unchanged

**Scope:**
All inputs and operations on Windows platform should be completely unaffected by this fix. This includes:
- Icon loading on Windows (continues using .ico)
- Process spawning on Windows (continues using cmd.exe)
- All user interactions (tray clicks, shortcuts, menu items)
- Application lifecycle events (ready, quit, close, minimize)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Hardcoded Icon Path**: The code uses `path.join(__dirname, "icon.ico")` without platform detection
   - Linux/macOS do not support .ico format natively
   - Electron's Tray requires platform-appropriate formats or nativeImage API
   - Solution: Use `nativeImage.createEmpty()` for non-Windows or provide .png alternative

2. **Hardcoded Windows Shell**: The code uses `spawn("cmd.exe", ["/c", "npm", ...])` without platform detection
   - cmd.exe only exists on Windows
   - Linux/macOS use different shells (bash, sh, zsh)
   - Solution: Use npm directly on Linux/macOS, or use shell: true option

3. **Insufficient Error Handling**: The startOllama() function catches errors in the 'error' event but doesn't prevent the spawn call from failing
   - The spawn() call itself can throw synchronously if the command doesn't exist
   - The error event handler only catches async errors after spawn succeeds
   - Solution: Wrap spawn() in try-catch and handle both sync and async errors

4. **Missing Platform Detection**: The code lacks any platform detection logic
   - No use of process.platform to branch behavior
   - The codebase has OsAdapter.ts with platform detection utilities but main.cjs doesn't use them
   - Solution: Implement platform detection in main.cjs (can't import OsAdapter.ts since it's TypeScript)

## Correctness Properties

Property 1: Bug Condition - Cross-Platform Compatibility

_For any_ platform where the bug condition holds (Linux or macOS for icon/process bugs, any platform for Ollama error), the fixed application SHALL start successfully using platform-appropriate icon loading (nativeImage or .png), platform-appropriate process spawning (npm directly on Linux/macOS, cmd.exe on Windows), and graceful error handling for Ollama (try-catch wrapping spawn with proper error logging).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Windows Functionality

_For any_ operation on Windows platform where the bug condition does NOT hold, the fixed application SHALL produce exactly the same behavior as the original application, preserving .ico icon usage, cmd.exe process spawning, tray functionality, global shortcuts, and all user interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `electron/main.cjs`

**Specific Changes**:

1. **Add Platform Detection Helper**:
   - Add `isWindows()` function at the top of the file: `function isWindows() { return process.platform === 'win32'; }`
   - This mirrors the pattern in OsAdapter.ts but in plain JavaScript

2. **Fix Icon Loading (createTray function)**:
   - Replace hardcoded `iconPath` usage in `new Tray(iconPath)` with platform-conditional logic
   - On Windows: continue using `iconPath` (icon.ico)
   - On Linux/macOS: use `nativeImage.createEmpty()` or check for icon.png alternative
   - Also update `mainWindow` icon in `createWindow()` function

3. **Fix Process Spawning (startProcesses function)**:
   - Replace `spawn("cmd.exe", ["/c", "npm", "run", "server"])` with platform-conditional logic
   - On Windows: continue using `cmd.exe` with `/c` flag
   - On Linux/macOS: use `spawn("npm", ["run", "server"])` directly
   - Apply same fix to both backendProcess and frontendProcess spawns

4. **Fix Ollama Error Handling (startOllama function)**:
   - Wrap the `spawn('ollama', ['serve'])` call in try-catch block
   - Catch synchronous errors (command not found) before they propagate
   - Keep existing error event handler for async errors
   - Ensure ollamaProcess is set to null on any error path

5. **Optional: Add icon.png Alternative**:
   - Consider adding icon.png to electron/ directory for better Linux/macOS support
   - Update icon loading logic to prefer .png on non-Windows platforms

### Implementation Pseudocode

```javascript
// Platform detection
function isWindows() {
  return process.platform === 'win32';
}

// Icon loading fix
function createTray() {
  const { nativeImage } = require('electron');
  let trayIcon;
  
  if (isWindows()) {
    trayIcon = iconPath; // Use .ico on Windows
  } else {
    // Use empty image or .png alternative on Linux/macOS
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  // ... rest of function
}

// Process spawning fix
function startProcesses() {
  const projectRoot = path.join(__dirname, "..");
  
  if (isWindows()) {
    backendProcess = spawn("cmd.exe", ["/c", "npm", "run", "server"], {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true,
    });
  } else {
    backendProcess = spawn("npm", ["run", "server"], {
      cwd: projectRoot,
      stdio: "inherit",
    });
  }
  // ... same for frontendProcess
}

// Ollama error handling fix
function startOllama() {
  isOllamaRunning().then((running) => {
    if (running) {
      console.log('[Ollama] Already running');
      return;
    }

    console.log('[Ollama] Starting...');
    
    try {
      ollamaProcess = spawn('ollama', ['serve'], {
        detached: false,
        stdio: 'ignore',
        windowsHide: isWindows(),
      });

      ollamaProcess.on('error', (err) => {
        console.error('[Ollama] Failed to start:', err.message);
        ollamaProcess = null;
      });

      if (ollamaProcess && ollamaProcess.pid) {
        console.log('[Ollama] Started with PID:', ollamaProcess.pid);
      }
    } catch (err) {
      console.error('[Ollama] Not installed or failed to start:', err.message);
      ollamaProcess = null;
    }
  });
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code running on Linux, then verify the fix works correctly on both Linux and Windows while preserving all existing Windows functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Run the unfixed application on a Linux system (or Linux VM/container) and observe the failures. Document the exact error messages and failure points. This will confirm our hypothesis about icon loading, process spawning, and Ollama error handling.

**Test Cases**:
1. **Linux Icon Loading Test**: Start application on Linux, observe tray icon failure (will fail on unfixed code)
2. **Linux Process Spawning Test**: Start application on Linux, observe "spawn cmd.exe ENOENT" error (will fail on unfixed code)
3. **Ollama Not Installed Test**: Start application on any platform without Ollama installed, observe error handling (may fail on unfixed code)
4. **macOS Compatibility Test**: Start application on macOS, observe same icon and process spawning issues (will fail on unfixed code)

**Expected Counterexamples**:
- Tray icon fails to load on Linux with .ico format error
- Application crashes with "spawn cmd.exe ENOENT" on Linux
- Ollama spawn errors are not properly caught when Ollama is not installed
- Possible causes: hardcoded Windows-specific paths and commands, missing platform detection, insufficient error handling

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL platform WHERE platform IN ['linux', 'darwin'] DO
  result := startApplication_fixed(platform)
  ASSERT result.trayIconLoaded == true
  ASSERT result.processesSpawned == true
  ASSERT result.applicationRunning == true
END FOR

FOR ALL platform WHERE ollamaNotInstalled() DO
  result := startApplication_fixed(platform)
  ASSERT result.ollamaErrorHandled == true
  ASSERT result.applicationRunning == true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (Windows platform), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL operation WHERE platform == 'win32' DO
  ASSERT startApplication_original(operation) == startApplication_fixed(operation)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different user interactions
- It catches edge cases that manual unit tests might miss (different window states, tray interactions, shortcut combinations)
- It provides strong guarantees that Windows behavior is unchanged for all operations

**Test Plan**: Observe behavior on UNFIXED code on Windows first for all tray interactions, shortcuts, and process management, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Windows Icon Preservation**: Verify .ico icon continues to load correctly on Windows after fix
2. **Windows Process Spawning Preservation**: Verify cmd.exe continues to be used on Windows after fix
3. **Tray Interaction Preservation**: Verify all tray menu items and click behavior work identically on Windows
4. **Global Shortcut Preservation**: Verify Ctrl+Space continues to work identically on Windows
5. **Window Lifecycle Preservation**: Verify minimize, close, show, hide behavior is identical on Windows

### Unit Tests

- Test platform detection function (isWindows) returns correct values
- Test icon loading on each platform (Windows uses .ico, Linux/macOS use nativeImage)
- Test process spawning on each platform (Windows uses cmd.exe, Linux/macOS use npm directly)
- Test Ollama error handling with mocked spawn that throws errors
- Test edge cases (missing icon files, npm not in PATH, Ollama already running)

### Property-Based Tests

- Generate random platform values and verify correct icon loading strategy is chosen
- Generate random process spawn scenarios and verify correct shell is used
- Generate random Ollama installation states and verify graceful error handling
- Test that all Windows operations produce identical results across many scenarios

### Integration Tests

- Test full application startup on Linux with all three fixes applied
- Test full application startup on Windows to verify preservation
- Test switching between platforms (if using VM or container) and verify correct behavior
- Test that visual feedback (tray icon, window) appears correctly on each platform
- Test that backend and frontend processes start successfully on each platform
- Test that Ollama status is correctly reported regardless of installation state
