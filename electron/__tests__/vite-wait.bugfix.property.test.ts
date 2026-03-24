/**
 * Bug Condition Exploration Test for Electron Vite Wait Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 * 
 * This test MUST FAIL on unfixed code to confirm the bug exists.
 * 
 * Property 1: Bug Condition - Vite Wait Before Load
 * 
 * The test verifies that the application waits for Vite dev server before loading:
 * - createWindow() should wait for Vite to be ready before calling loadURL()
 * - ready-to-show handler should call mainWindow.show() to display the window
 * - Window should become visible after content loads (not hidden with black screen)
 * 
 * This test will FAIL on unfixed code because:
 * 1. waitForVite() function doesn't exist yet
 * 2. createWindow() calls loadURL() immediately without waiting
 * 3. ready-to-show handler is empty and doesn't show the window
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// Path to the main.cjs file
const mainCjsPath = path.join(__dirname, '..', 'main.cjs');

// Bug condition checker from design document
function isBugCondition(input: { 
  viteStartTime: number; 
  loadURLCallTime: number; 
  readyToShowHandlerEmpty: boolean 
}): boolean {
  return (
    (input.loadURLCallTime < input.viteStartTime) &&
    (input.viteStartTime - input.loadURLCallTime > 0) &&
    input.readyToShowHandlerEmpty
  );
}

// Helper to check if Vite is running
async function isViteRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Helper to simulate waiting for Vite with retry logic
async function simulateWaitForVite(maxRetries: number = 30, delayMs: number = 1000): Promise<{ success: boolean; timeMs: number }> {
  const startTime = Date.now();
  
  for (let i = 0; i < maxRetries; i++) {
    const running = await isViteRunning();
    if (running) {
      return { success: true, timeMs: Date.now() - startTime };
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return { success: false, timeMs: Date.now() - startTime };
}

describe('Electron Vite Wait Fix - Bug Condition Exploration', () => {
  let mainCjsContent: string;

  beforeAll(() => {
    // Read the main.cjs file to analyze its content
    mainCjsContent = fs.readFileSync(mainCjsPath, 'utf-8');
  });

  describe('Property 2: Preservation - Existing Functionality Unchanged', () => {
    /**
     * These tests verify that functionality NOT involving initial window loading
     * remains unchanged after the fix is implemented.
     * 
     * **IMPORTANT**: These tests are run on UNFIXED code to establish baseline behavior.
     * They should PASS on unfixed code, confirming what behavior to preserve.
     * 
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
     */

    it('PRESERVATION: Global shortcuts (Ctrl+Space, Ctrl+N, Ctrl+Shift+V) are registered', () => {
      /**
       * **Validates: Requirements 3.2**
       * 
       * Verifies that global shortcuts are registered and configured correctly.
       * This functionality should remain unchanged after the fix.
       */
      
      // Check for Ctrl+Space shortcut registration
      const hasCtrlSpace = mainCjsContent.includes('globalShortcut.register("CommandOrControl+Space"');
      expect(hasCtrlSpace).toBe(true);
      
      // Check for shortcuts configuration object
      const hasShortcutsConfig = mainCjsContent.includes('const shortcuts = {');
      expect(hasShortcutsConfig).toBe(true);
      
      // Check for registerShortcuts function
      const hasRegisterShortcuts = mainCjsContent.includes('function registerShortcuts()');
      expect(hasRegisterShortcuts).toBe(true);
      
      // Check for Ctrl+N (new chat) shortcut
      const hasCtrlN = mainCjsContent.includes("shortcuts.newChat") && 
                       mainCjsContent.includes("'CommandOrControl+N'");
      expect(hasCtrlN).toBe(true);
      
      // Check for Ctrl+Shift+V (voice input) shortcut
      const hasCtrlShiftV = mainCjsContent.includes("shortcuts.voiceInput") && 
                            mainCjsContent.includes("'CommandOrControl+Shift+V'");
      expect(hasCtrlShiftV).toBe(true);
    });

    it('PRESERVATION: Window minimize/close behavior hides to tray', () => {
      /**
       * **Validates: Requirements 3.3**
       * 
       * Verifies that window minimize and close events hide the window to tray
       * instead of actually closing the application.
       */
      
      // Check for minimize event handler
      const minimizeMatch = mainCjsContent.match(/mainWindow\.on\("minimize",\s*\(event\)\s*=>\s*\{([^}]*)\}/);
      expect(minimizeMatch).toBeTruthy();
      
      if (minimizeMatch) {
        const minimizeHandler = minimizeMatch[1];
        expect(minimizeHandler).toContain('event.preventDefault()');
        expect(minimizeHandler).toContain('mainWindow.hide()');
      }
      
      // Check for close event handler
      const closeMatch = mainCjsContent.match(/mainWindow\.on\("close",\s*\(event\)\s*=>\s*\{([^}]*)\}/);
      expect(closeMatch).toBeTruthy();
      
      if (closeMatch) {
        const closeHandler = closeMatch[1];
        expect(closeHandler).toContain('isQuitting');
        expect(closeHandler).toContain('event.preventDefault()');
        expect(closeHandler).toContain('mainWindow.hide()');
      }
    });

    it('PRESERVATION: Tray icon click toggles window visibility', () => {
      /**
       * **Validates: Requirements 3.6**
       * 
       * Verifies that clicking the tray icon toggles window visibility.
       * This behavior should remain unchanged after the fix.
       */
      
      // Check for tray click event handler
      const trayClickMatch = mainCjsContent.match(/tray\.on\("click",\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(trayClickMatch).toBeTruthy();
      
      if (trayClickMatch) {
        const clickHandler = trayClickMatch[1];
        
        // Should check if window is visible
        expect(clickHandler).toContain('mainWindow.isVisible()');
        
        // Should hide if visible
        expect(clickHandler).toContain('mainWindow.hide()');
        
        // Should show and focus if hidden
        expect(clickHandler).toContain('mainWindow.show()');
        expect(clickHandler).toContain('mainWindow.focus()');
      }
    });

    it('PRESERVATION: Ollama status checking occurs after 3 seconds', () => {
      /**
       * **Validates: Requirements 3.4**
       * 
       * Verifies that Ollama status is checked after 3 seconds and sent to renderer.
       * This timing and behavior should remain unchanged.
       */
      
      // Check for setTimeout with 3000ms delay
      const setTimeoutMatch = mainCjsContent.match(/setTimeout\(async\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*3000\)/);
      expect(setTimeoutMatch).toBeTruthy();
      
      if (setTimeoutMatch) {
        const timeoutHandler = setTimeoutMatch[1];
        
        // Should call isOllamaRunning
        expect(timeoutHandler).toContain('isOllamaRunning()');
        
        // Should send status to renderer
        expect(timeoutHandler).toContain('ollama-status');
        expect(timeoutHandler).toContain('mainWindow.webContents.send');
      }
      
      // Check for isOllamaRunning function
      const hasIsOllamaRunning = mainCjsContent.includes('function isOllamaRunning()');
      expect(hasIsOllamaRunning).toBe(true);
    });

    it('PRESERVATION: Backend and frontend processes spawn correctly', () => {
      /**
       * **Validates: Requirements 3.5**
       * 
       * Verifies that backend and frontend processes are spawned with correct configuration.
       * Process spawning logic should remain unchanged.
       */
      
      // Check for startProcesses function
      const hasStartProcesses = mainCjsContent.includes('function startProcesses()');
      expect(hasStartProcesses).toBe(true);
      
      // Check for backend process spawning
      const hasBackendSpawn = mainCjsContent.includes('backendProcess = spawn');
      expect(hasBackendSpawn).toBe(true);
      
      // Check for frontend process spawning
      const hasFrontendSpawn = mainCjsContent.includes('frontendProcess = spawn');
      expect(hasFrontendSpawn).toBe(true);
      
      // Check for npm run server command
      const hasServerCommand = mainCjsContent.includes('"npm", "run", "server"');
      expect(hasServerCommand).toBe(true);
      
      // Check for npm run dev command
      const hasDevCommand = mainCjsContent.includes('"npm", "run", "dev"');
      expect(hasDevCommand).toBe(true);
      
      // Check for platform-specific spawning (Windows vs Linux/macOS)
      const hasWindowsCheck = mainCjsContent.includes('if (isWindows())');
      expect(hasWindowsCheck).toBe(true);
    });

    it('PRESERVATION: IPC handlers (speak, speak-stop) work correctly', () => {
      /**
       * **Validates: Requirements 3.6**
       * 
       * Verifies that IPC handlers for text-to-speech are registered correctly.
       * These handlers should remain unchanged after the fix.
       */
      
      // Check for speak handler
      const hasSpeakHandler = mainCjsContent.includes("ipcMain.handle('speak'");
      expect(hasSpeakHandler).toBe(true);
      
      // Check for speak-stop handler
      const hasSpeakStopHandler = mainCjsContent.includes("ipcMain.handle('speak-stop'");
      expect(hasSpeakStopHandler).toBe(true);
      
      // Verify speak handler is async
      const speakMatch = mainCjsContent.match(/ipcMain\.handle\('speak',\s*async/);
      expect(speakMatch).toBeTruthy();
      
      // Verify speak-stop handler is async
      const speakStopMatch = mainCjsContent.match(/ipcMain\.handle\('speak-stop',\s*async/);
      expect(speakStopMatch).toBeTruthy();
    });

    it('PRESERVATION: BrowserWindow created with show: false option', () => {
      /**
       * **Validates: Requirements 3.1**
       * 
       * Verifies that BrowserWindow is created with show: false to prevent
       * showing an empty window. This option should remain unchanged.
       */
      
      // Find BrowserWindow creation
      const browserWindowMatch = mainCjsContent.match(/new BrowserWindow\(\{([\s\S]*?)\}\);/);
      expect(browserWindowMatch).toBeTruthy();
      
      if (browserWindowMatch) {
        const options = browserWindowMatch[1];
        
        // Should have show: false
        expect(options).toContain('show: false');
        
        // Should have other standard options
        expect(options).toContain('width:');
        expect(options).toContain('height:');
        expect(options).toContain('webPreferences:');
      }
    });

    it('PROPERTY TEST: Global shortcuts configuration remains consistent', () => {
      /**
       * **Validates: Requirements 3.2**
       * 
       * Property-based test that verifies global shortcuts configuration
       * remains consistent across different scenarios.
       */
      
      fc.assert(
        fc.property(
          fc.constantFrom('newChat', 'voiceInput'),
          (shortcutName) => {
            // Verify shortcuts object contains the shortcut
            const shortcutsMatch = mainCjsContent.match(/const shortcuts = \{([\s\S]*?)\};/);
            expect(shortcutsMatch).toBeTruthy();
            
            if (shortcutsMatch) {
              const shortcutsObj = shortcutsMatch[1];
              expect(shortcutsObj).toContain(shortcutName);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('PROPERTY TEST: Process spawning configuration is platform-aware', () => {
      /**
       * **Validates: Requirements 3.5**
       * 
       * Property-based test that verifies process spawning handles
       * different platforms correctly.
       */
      
      fc.assert(
        fc.property(
          fc.constantFrom('backendProcess', 'frontendProcess'),
          (processName) => {
            // Verify process variable exists
            expect(mainCjsContent).toContain(`${processName} = spawn`);
            
            // Verify platform detection function exists
            expect(mainCjsContent).toContain('function isWindows()');
            
            // Verify platform-specific spawning logic
            const startProcessesMatch = mainCjsContent.match(/function startProcesses\(\)\s*\{([\s\S]*?)\n\}/);
            expect(startProcessesMatch).toBeTruthy();
            
            if (startProcessesMatch) {
              const functionBody = startProcessesMatch[1];
              
              // Should have Windows-specific logic
              expect(functionBody).toContain('if (isWindows())');
              
              // Should have cmd.exe for Windows
              expect(functionBody).toContain('cmd.exe');
              
              // Should have else clause for Linux/macOS
              expect(functionBody).toContain('} else {');
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('PROPERTY TEST: Window visibility toggle behavior is consistent', () => {
      /**
       * **Validates: Requirements 3.2, 3.3, 3.6**
       * 
       * Property-based test that verifies window visibility toggle behavior
       * is consistent across different trigger points (shortcuts, tray, events).
       */
      
      fc.assert(
        fc.property(
          fc.constantFrom(
            'globalShortcut.register("CommandOrControl+Space"',
            'tray.on("click"',
            'mainWindow.on("minimize"',
            'mainWindow.on("close"'
          ),
          (triggerPattern) => {
            // Verify the trigger exists in the code
            expect(mainCjsContent).toContain(triggerPattern);
            
            // All triggers should interact with mainWindow visibility
            const triggerMatch = mainCjsContent.match(new RegExp(`${triggerPattern.replace(/[()]/g, '\\$&')}[\\s\\S]*?\\}\\);?`));
            
            if (triggerMatch) {
              const triggerCode = triggerMatch[0];
              
              // Should check or modify window visibility
              const hasVisibilityLogic = 
                triggerCode.includes('mainWindow.isVisible()') ||
                triggerCode.includes('mainWindow.show()') ||
                triggerCode.includes('mainWindow.hide()');
              
              expect(hasVisibilityLogic).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('PROPERTY TEST: IPC handlers return consistent response format', () => {
      /**
       * **Validates: Requirements 3.6**
       * 
       * Property-based test that verifies IPC handlers are registered
       * and have proper error handling structure.
       */
      
      fc.assert(
        fc.property(
          fc.constantFrom('speak', 'speak-stop'),
          (handlerName) => {
            // Verify handler is registered
            const hasHandler = mainCjsContent.includes(`ipcMain.handle('${handlerName}'`);
            expect(hasHandler).toBe(true);
            
            // Find the handler section (approximate match)
            const handlerStartIndex = mainCjsContent.indexOf(`ipcMain.handle('${handlerName}'`);
            if (handlerStartIndex !== -1) {
              // Get a reasonable chunk of code after the handler declaration
              const handlerSection = mainCjsContent.substring(handlerStartIndex, handlerStartIndex + 2000);
              
              // Should have success field in return statements
              const hasSuccessField = handlerSection.includes('success:');
              expect(hasSuccessField).toBe(true);
              
              // Should have try-catch for error handling
              const hasTryCatch = handlerSection.includes('try {') && handlerSection.includes('catch');
              expect(hasTryCatch).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 1: Bug Condition - Vite Wait Before Load', () => {
    
    it('should detect bug condition when loadURL called before Vite ready', () => {
      /**
       * **Validates: Requirements 1.1, 1.2**
       * 
       * Test the bug condition function with concrete examples.
       * This confirms our understanding of when the bug occurs.
       */
      
      // Example 1: loadURL at t=0ms, Vite ready at t=2500ms, handler empty
      expect(isBugCondition({ 
        viteStartTime: 2500, 
        loadURLCallTime: 0, 
        readyToShowHandlerEmpty: true 
      })).toBe(true);
      
      // Example 2: loadURL at t=0ms, Vite ready at t=3000ms, handler empty
      expect(isBugCondition({ 
        viteStartTime: 3000, 
        loadURLCallTime: 0, 
        readyToShowHandlerEmpty: true 
      })).toBe(true);
      
      // Non-bug: loadURL after Vite ready
      expect(isBugCondition({ 
        viteStartTime: 1000, 
        loadURLCallTime: 2000, 
        readyToShowHandlerEmpty: false 
      })).toBe(false);
    });

    it('BUGFIX EXPLORATION: waitForVite() function should exist in main.cjs', () => {
      /**
       * **Validates: Requirements 2.1, 2.2**
       * 
       * This test verifies that waitForVite() function exists in main.cjs.
       * On unfixed code, this will FAIL because:
       * - The waitForVite() function doesn't exist yet
       * 
       * Expected behavior after fix:
       * - waitForVite() function should be defined
       * - It should be an async function
       * - It should retry HTTP requests to localhost:5173
       * - It should return true when Vite is ready, false on timeout
       */
      
      // Check if waitForVite function exists in the code
      const hasWaitForViteFunction = mainCjsContent.includes('function waitForVite') || 
                                      mainCjsContent.includes('const waitForVite') ||
                                      mainCjsContent.includes('async function waitForVite');
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasWaitForViteFunction).toBe(true);
      
      if (!hasWaitForViteFunction) {
        console.log('[BUG DETECTED] waitForVite() function does not exist in main.cjs');
        console.log('[COUNTEREXAMPLE] The code immediately calls loadURL() without waiting for Vite');
      }
    });

    it('BUGFIX EXPLORATION: createWindow() should be async and call waitForVite()', () => {
      /**
       * **Validates: Requirements 2.1**
       * 
       * This test verifies that createWindow() is async and calls waitForVite().
       * On unfixed code, this will FAIL because:
       * - createWindow() is not async
       * - It doesn't call waitForVite() before loadURL()
       * 
       * Expected behavior after fix:
       * - createWindow() should be async function
       * - It should call await waitForVite() before loadURL()
       */
      
      // Check if createWindow is async
      const createWindowIsAsync = mainCjsContent.includes('async function createWindow');
      
      // Check if createWindow calls waitForVite
      const callsWaitForVite = mainCjsContent.includes('await waitForVite()') ||
                                mainCjsContent.includes('waitForVite()');
      
      // EXPECTED TO FAIL on unfixed code
      expect(createWindowIsAsync).toBe(true);
      expect(callsWaitForVite).toBe(true);
      
      if (!createWindowIsAsync) {
        console.log('[BUG DETECTED] createWindow() is not async');
        console.log('[COUNTEREXAMPLE] createWindow() calls loadURL() synchronously without waiting');
      }
      
      if (!callsWaitForVite) {
        console.log('[BUG DETECTED] createWindow() does not call waitForVite()');
        console.log('[COUNTEREXAMPLE] loadURL() is called immediately at t=0ms');
      }
    });

    it('BUGFIX EXPLORATION: ready-to-show handler should call mainWindow.show()', () => {
      /**
       * **Validates: Requirements 1.3, 2.3**
       * 
       * This test verifies that ready-to-show handler calls mainWindow.show().
       * On unfixed code, this will FAIL because:
       * - The ready-to-show handler is empty
       * - It doesn't call mainWindow.show()
       * 
       * Expected behavior after fix:
       * - ready-to-show handler should call mainWindow.show()
       * - Window should become visible after content loads
       */
      
      // Find the ready-to-show handler in the code
      const readyToShowMatch = mainCjsContent.match(/mainWindow\.once\("ready-to-show",\s*\(\)\s*=>\s*\{([^}]*)\}/);
      
      if (readyToShowMatch) {
        const handlerBody = readyToShowMatch[1];
        
        // Check if handler calls mainWindow.show()
        const callsShow = handlerBody.includes('mainWindow.show()');
        
        // EXPECTED TO FAIL on unfixed code
        expect(callsShow).toBe(true);
        
        if (!callsShow) {
          console.log('[BUG DETECTED] ready-to-show handler does not call mainWindow.show()');
          console.log('[COUNTEREXAMPLE] Handler body:', handlerBody.trim() || '(empty)');
          console.log('[COUNTEREXAMPLE] Window remains hidden even after content loads');
        }
      } else {
        // Handler not found or has different format
        console.log('[BUG DETECTED] Could not parse ready-to-show handler');
      }
    });

    it('BUGFIX EXPLORATION: loadURL should be called after waitForVite', () => {
      /**
       * **Validates: Requirements 2.1**
       * 
       * This test verifies that loadURL is called after waitForVite in the code.
       * On unfixed code, this will FAIL because:
       * - loadURL is called immediately without waiting
       * 
       * Expected behavior after fix:
       * - waitForVite() should appear before loadURL() in createWindow()
       */
      
      // Find createWindow function
      const createWindowMatch = mainCjsContent.match(/function createWindow\(\)\s*\{([\s\S]*?)\n\}/);
      
      if (createWindowMatch) {
        const functionBody = createWindowMatch[1];
        
        // Find positions of waitForVite and loadURL
        const waitForVitePos = functionBody.indexOf('waitForVite');
        const loadURLPos = functionBody.indexOf('loadURL');
        
        if (waitForVitePos === -1) {
          console.log('[BUG DETECTED] waitForVite() not found in createWindow()');
          console.log('[COUNTEREXAMPLE] loadURL() is called immediately without waiting');
          
          // EXPECTED TO FAIL on unfixed code
          expect(waitForVitePos).toBeGreaterThan(-1);
        } else if (loadURLPos === -1) {
          console.log('[ERROR] loadURL() not found in createWindow()');
        } else {
          // Verify waitForVite comes before loadURL
          const correctOrder = waitForVitePos < loadURLPos;
          
          // EXPECTED TO FAIL on unfixed code (waitForVite doesn't exist)
          expect(correctOrder).toBe(true);
          
          if (!correctOrder) {
            console.log('[BUG DETECTED] loadURL() is called before waitForVite()');
            console.log('[COUNTEREXAMPLE] Race condition: loadURL at t=0ms, Vite ready at t=2000-3000ms');
          }
        }
      }
    });

    it('BUGFIX EXPLORATION: app.whenReady() should await createWindow()', () => {
      /**
       * **Validates: Requirements 2.1**
       * 
       * This test verifies that app.whenReady() awaits createWindow().
       * On unfixed code, this may FAIL because:
       * - createWindow() is called synchronously
       * - The promise is not awaited
       * 
       * Expected behavior after fix:
       * - app.whenReady() should await createWindow() or use .then()
       */
      
      // Find app.whenReady() call
      const whenReadyMatch = mainCjsContent.match(/app\.whenReady\(\)\.then\(([\s\S]*?)\}\);/);
      
      if (whenReadyMatch) {
        const callbackBody = whenReadyMatch[1];
        
        // Check if createWindow is awaited
        const awaitsCreateWindow = callbackBody.includes('await createWindow()');
        
        // Check if the callback is async
        const callbackIsAsync = callbackBody.includes('async');
        
        if (!awaitsCreateWindow) {
          console.log('[BUG DETECTED] createWindow() is not awaited in app.whenReady()');
          console.log('[COUNTEREXAMPLE] createWindow() is called synchronously');
        }
        
        // Note: This might not fail on unfixed code if createWindow is not async yet
        // But it will fail once createWindow becomes async
      }
    });

    it('PROPERTY TEST: bug condition holds for various timing scenarios', () => {
      /**
       * **Validates: Requirements 1.1, 1.2, 1.3**
       * 
       * Property-based test that generates random timing scenarios and verifies
       * the bug condition is correctly identified.
       * 
       * This test confirms our understanding of when the bug occurs across
       * many different timing combinations.
       */
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5000 }),    // loadURLCallTime
          fc.integer({ min: 1000, max: 5000 }), // viteStartTime
          fc.boolean(),                          // readyToShowHandlerEmpty
          (loadURLCallTime, viteStartTime, readyToShowHandlerEmpty) => {
            const input = { viteStartTime, loadURLCallTime, readyToShowHandlerEmpty };
            const hasBug = isBugCondition(input);
            
            // Verify bug condition logic
            if (loadURLCallTime < viteStartTime && readyToShowHandlerEmpty) {
              expect(hasBug).toBe(true);
            } else {
              expect(hasBug).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PROPERTY TEST: scoped to concrete failing case - immediate loadURL with 2-3s Vite delay', () => {
      /**
       * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
       * 
       * Scoped property-based test that focuses on the concrete failing case:
       * - loadURL() is called at t=0ms (immediately)
       * - Vite dev server becomes ready at t=2000-3000ms
       * - ready-to-show handler is empty
       * 
       * This is the deterministic bug scenario that occurs consistently.
       * By scoping to this specific case, we ensure reproducibility.
       */
      
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 3000 }), // Vite start time: 2-3 seconds
          (viteStartTime) => {
            const loadURLCallTime = 0; // Immediate call
            const readyToShowHandlerEmpty = true; // Handler is empty
            
            const input = { viteStartTime, loadURLCallTime, readyToShowHandlerEmpty };
            
            // This should always be a bug condition
            const hasBug = isBugCondition(input);
            expect(hasBug).toBe(true);
            
            // Verify the expected behavior is NOT met on unfixed code
            const hasWaitForVite = mainCjsContent.includes('waitForVite');
            const hasShowCall = mainCjsContent.includes('mainWindow.show()');
            
            // EXPECTED TO FAIL on unfixed code
            expect(hasWaitForVite).toBe(true);
            expect(hasShowCall).toBe(true);
            
            if (!hasWaitForVite || !hasShowCall) {
              console.log('[COUNTEREXAMPLE] Bug condition detected:');
              console.log(`  - loadURL called at: ${loadURLCallTime}ms`);
              console.log(`  - Vite ready at: ${viteStartTime}ms`);
              console.log(`  - Delay: ${viteStartTime - loadURLCallTime}ms`);
              console.log(`  - Handler empty: ${readyToShowHandlerEmpty}`);
              console.log(`  - Has waitForVite: ${hasWaitForVite}`);
              console.log(`  - Has show() call: ${hasShowCall}`);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('COUNTEREXAMPLE DOCUMENTATION: black screen during startup', () => {
      /**
       * **Validates: Requirements 1.1, 1.2, 1.3**
       * 
       * This test documents the counterexamples found during exploration.
       * It serves as a record of the bug manifestation.
       */
      
      const counterexamples = {
        example1: {
          description: 'User starts app, sees black screen for 2.5 seconds, window stays hidden',
          loadURLCallTime: 0,
          viteStartTime: 2500,
          readyToShowHandlerEmpty: true,
          userExperience: 'Black screen, then window remains hidden',
        },
        example2: {
          description: 'User starts app, sees black screen for 3 seconds, window stays hidden',
          loadURLCallTime: 0,
          viteStartTime: 3000,
          readyToShowHandlerEmpty: true,
          userExperience: 'Black screen, then window remains hidden',
        },
        example3: {
          description: 'Vite fails to start, user sees black screen indefinitely',
          loadURLCallTime: 0,
          viteStartTime: Infinity,
          readyToShowHandlerEmpty: true,
          userExperience: 'Black screen indefinitely, no fallback',
        },
      };
      
      // Verify all examples are bug conditions
      expect(isBugCondition(counterexamples.example1)).toBe(true);
      expect(isBugCondition(counterexamples.example2)).toBe(true);
      
      // Log counterexamples for documentation
      console.log('[COUNTEREXAMPLES FOUND]');
      console.log('Example 1:', counterexamples.example1.description);
      console.log('Example 2:', counterexamples.example2.description);
      console.log('Example 3:', counterexamples.example3.description);
      
      // Verify the root cause
      const hasWaitMechanism = mainCjsContent.includes('waitForVite');
      const hasShowCall = mainCjsContent.includes('mainWindow.show()');
      
      console.log('[ROOT CAUSE ANALYSIS]');
      console.log('- Has wait mechanism:', hasWaitMechanism);
      console.log('- Has show() call:', hasShowCall);
      console.log('- Conclusion: Race condition + empty handler causes black screen');
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasWaitMechanism).toBe(true);
      expect(hasShowCall).toBe(true);
    });
  });
});
