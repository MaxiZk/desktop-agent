# Bug Condition Exploration - Counterexamples Found

This document records the counterexamples found when running the bug condition exploration test on **UNFIXED** code.

## Test Execution Details

- **Platform**: Linux (process.platform = 'linux')
- **Test File**: `electron/__tests__/main.bugfix.property.test.ts`
- **Date**: Task 1 execution
- **Status**: Test FAILED as expected (confirms bugs exist)

## Counterexample 1: Icon Loading Bug

**Requirement**: 1.1 - Icon loading should use platform-appropriate format

**Bug Condition**:
```javascript
isBugCondition({ platform: 'linux', operation: 'loadIcon' }) === true
```

**Observed Behavior**:
- The unfixed code in `electron/main.cjs` uses hardcoded `.ico` icon path
- No platform detection exists (`hasPlatformDetection = false`)
- On Linux/macOS, `.ico` format is not natively supported
- This causes tray icon to fail loading or appear broken

**Expected Behavior After Fix**:
- Windows: Continue using `icon.ico`
- Linux/macOS: Use `nativeImage.createEmpty()` or provide `.png` alternative

**Error Message**: 
```
AssertionError: expected false to be true
- Expected: true (should have platform detection)
+ Received: false (no platform detection in unfixed code)
```

## Counterexample 2: Process Spawning Bug

**Requirement**: 1.2 - Process spawning should use platform-appropriate shell

**Bug Condition**:
```javascript
isBugCondition({ platform: 'linux', operation: 'spawnProcess' }) === true
```

**Observed Behavior**:
- The unfixed code uses `spawn("cmd.exe", ["/c", "npm", "run", "server"])`
- cmd.exe doesn't exist on Linux/macOS
- Attempting to spawn cmd.exe throws ENOENT error
- This causes the application to crash on startup

**Expected Behavior After Fix**:
- Windows: Continue using `cmd.exe` with `/c` flag
- Linux/macOS: Use `npm` directly without cmd.exe wrapper

**Error Message**:
```
[BUG DETECTED] cmd.exe does not exist on Linux/macOS: spawn cmd.exe ENOENT
AssertionError: expected true to be false
- Expected: false (should NOT use cmd.exe on Linux)
+ Received: true (unfixed code uses cmd.exe)
```

## Counterexample 3: Ollama Error Handling Bug

**Requirement**: 1.3 - Ollama spawn should handle missing installation gracefully

**Bug Condition**:
```javascript
isBugCondition({ operation: 'startOllama', ollamaNotInstalled: true }) === true
```

**Observed Behavior**:
- The unfixed code spawns Ollama with error event handler
- Error event handler catches async errors after spawn succeeds
- However, synchronous errors during spawn (command not found) may not be caught
- The spawn call is not wrapped in try-catch

**Expected Behavior After Fix**:
- Wrap `spawn('ollama', ['serve'])` in try-catch block
- Catch both synchronous and asynchronous errors
- Set `ollamaProcess = null` on any error
- Log error and continue application operation

**Error Message**:
```
spawn ollama-nonexistent-command-12345 ENOENT
```

## Root Cause Analysis

Based on the counterexamples, the root causes are confirmed:

1. **Missing Platform Detection**: No `isWindows()` or platform check exists in `electron/main.cjs`
2. **Hardcoded Windows Paths**: Icon path uses `.ico` without alternatives
3. **Hardcoded Windows Shell**: Process spawning always uses `cmd.exe`
4. **Insufficient Error Handling**: Ollama spawn lacks try-catch for synchronous errors

## Next Steps

1. ✅ Task 1: Bug condition exploration test written and run (FAILED as expected)
2. ⏭️ Task 2: Write preservation property tests for Windows functionality
3. ⏭️ Task 3: Implement fixes for all three bugs
4. ⏭️ Task 4: Verify bug condition test passes after fix
5. ⏭️ Task 5: Verify preservation tests still pass after fix
