const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const http = require("http");

// Enable Web Speech API for voice input
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI');
app.commandLine.appendSwitch('lang', 'es-AR');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;
let ollamaProcess = null;
let isQuitting = false;

const iconPath = path.join(__dirname, "icon.ico");

// Keyboard shortcuts configuration
const shortcuts = {
  newChat: 'CommandOrControl+N',
  voiceInput: 'CommandOrControl+Shift+V',
};

// Platform detection helper
function isWindows() {
  return process.platform === 'win32';
}

function isOllamaRunning() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://localhost:11434', (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

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

function stopOllama() {
  if (ollamaProcess) {
    console.log('[Ollama] Stopping...');
    try {
      ollamaProcess.kill();
    } catch (err) {
      console.error('[Ollama] Error stopping:', err.message);
    }
    ollamaProcess = null;
  }
}

/**
 * Wait for Vite dev server to be ready by retrying HTTP requests
 * @param {number} timeoutMs - Maximum time to wait in milliseconds (default: 30000)
 * @returns {Promise<boolean>} - true if Vite responds, false if timeout is reached
 */
function waitForVite(timeoutMs = 30000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const retryInterval = 500; // Check every 500ms
    let attemptCount = 0;

    console.log('[Vite] Waiting for dev server to be ready...');

    const checkVite = () => {
      attemptCount++;
      const elapsed = Date.now() - startTime;

      if (elapsed >= timeoutMs) {
        console.log(`[Vite] Timeout reached after ${attemptCount} attempts (${elapsed}ms)`);
        resolve(false);
        return;
      }

      const req = http.get('http://localhost:5173', (res) => {
        console.log(`[Vite] Dev server ready after ${attemptCount} attempts (${elapsed}ms)`);
        resolve(true);
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
          console.log(`[Vite] Attempt ${attemptCount}: Connection refused, retrying...`);
          setTimeout(checkVite, retryInterval);
        } else {
          console.error(`[Vite] Unexpected error:`, err.message);
          setTimeout(checkVite, retryInterval);
        }
      });

      req.setTimeout(2000, () => {
        req.destroy();
        console.log(`[Vite] Attempt ${attemptCount}: Request timeout, retrying...`);
        setTimeout(checkVite, retryInterval);
      });
    };

    checkVite();
  });
}

async function createWindow() {
  // Use platform-appropriate icon
  let windowIcon;
  if (isWindows()) {
    windowIcon = iconPath; // Use .ico on Windows
  } else {
    windowIcon = nativeImage.createEmpty(); // Use empty image on Linux/macOS
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: "Desktop Agent",
    icon: windowIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Wait for Vite dev server to be ready before loading
  const viteReady = await waitForVite();
  
  if (viteReady) {
    console.log('[Window] Loading Vite dev server at http://localhost:5173');
    mainWindow.loadURL("http://localhost:5173");
  } else {
    console.log('[Window] Vite unavailable, falling back to production build');
    const distPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(distPath);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Use platform-appropriate icon
  let trayIcon;
  if (isWindows()) {
    trayIcon = iconPath; // Use .ico on Windows
  } else {
    trayIcon = nativeImage.createEmpty(); // Use empty image on Linux/macOS
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Iniciar con Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          name: "Desktop Agent",
        });
      },
    },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        isQuitting = true;
        if (backendProcess) backendProcess.kill();
        if (frontendProcess) frontendProcess.kill();
        stopOllama();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Desktop Agent");
  tray.setContextMenu(contextMenu);

  // Single click to show/hide
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function startProcesses() {
  const projectRoot = path.join(__dirname, "..");

  // Use platform-appropriate process spawning
  if (isWindows()) {
    backendProcess = spawn("cmd.exe", ["/c", "npm", "run", "server"], {
      cwd: projectRoot,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });

    frontendProcess = spawn("cmd.exe", ["/c", "npm", "run", "dev"], {
      cwd: projectRoot,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
  } else {
    // On Linux/macOS, use npm directly without cmd.exe
    backendProcess = spawn("npm", ["run", "server"], {
      cwd: projectRoot,
      shell: false,
      stdio: "inherit",
    });

    frontendProcess = spawn("npm", ["run", "dev"], {
      cwd: projectRoot,
      shell: false,
      stdio: "inherit",
    });
  }

  backendProcess.on("error", (err) => {
    console.error("Backend process error:", err);
  });

  frontendProcess.on("error", (err) => {
    console.error("Frontend process error:", err);
  });
}

app.whenReady().then(async () => {
  try {
    // Start Ollama first
    startOllama();
    
    startProcesses();
    await createWindow();
    createTray();

    // Set to start with system
    app.setLoginItemSettings({
      openAtLogin: true,
      name: "Desktop Agent",
    });

    // Register global shortcut Ctrl+Space to show/hide
    globalShortcut.register("CommandOrControl+Space", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Register keyboard shortcuts
    registerShortcuts();

    // Check Ollama status after 3 seconds and notify renderer
    setTimeout(async () => {
      const running = await isOllamaRunning();
      if (mainWindow && !mainWindow.isDestroyed()) {
        const status = running ? 'connected' : 'disconnected';
        console.log('[Ollama] Status:', status);
        mainWindow.webContents.send('ollama-status', status);
      }
    }, 3000);
  } catch (error) {
    console.error("Error starting Electron app:", error);
  }
});

function registerShortcuts() {
  // Ctrl+N: New chat (clear history)
  globalShortcut.register(shortcuts.newChat, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Shortcut] New chat triggered');
      mainWindow.webContents.send('shortcut-new-chat');
    }
  });

  // Ctrl+Shift+V: Voice input
  globalShortcut.register(shortcuts.voiceInput, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Shortcut] Voice input triggered');
      mainWindow.webContents.send('shortcut-voice-input');
    }
  });

  console.log('[Shortcuts] Registered:', shortcuts);
}

app.on("will-quit", () => {
  // Stop Ollama
  stopOllama();
  
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// ── IPC Handlers ────────────────────────────────────────────────────────────

// Text-to-Speech handler with improved voice support
ipcMain.handle('speak', async (event, text) => {
  if (!text || typeof text !== 'string') {
    console.error('[TTS] Invalid text provided');
    return { success: false, error: 'Invalid text' };
  }

  console.log(`[TTS] Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

  try {
    if (isWindows()) {
      // Windows: Use PowerShell TTS
      const { spawn } = require('child_process');
      const psCommand = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${text.replace(/'/g, "''")}')`;
      
      const ps = spawn('powershell.exe', ['-Command', psCommand], {
        windowsHide: true,
      });

      return new Promise((resolve) => {
        ps.on('close', (code) => {
          if (code === 0) {
            console.log('[TTS] Speech completed successfully');
            resolve({ success: true });
          } else {
            console.error(`[TTS] PowerShell exited with code ${code}`);
            resolve({ success: false, error: `Exit code ${code}` });
          }
        });

        ps.on('error', (err) => {
          console.error('[TTS] PowerShell error:', err);
          resolve({ success: false, error: err.message });
        });
      });
    } else {
      // Linux: Try espeak-ng, then espeak, then festival
      const { spawn } = require('child_process');
      
      // Detect available TTS engine
      const detectEngine = () => {
        try {
          execSync('which espeak-ng', { stdio: 'ignore' });
          console.log('[TTS] Using espeak-ng');
          return 'espeak-ng';
        } catch {
          try {
            execSync('which espeak', { stdio: 'ignore' });
            console.log('[TTS] Using espeak');
            return 'espeak';
          } catch {
            try {
              execSync('which festival', { stdio: 'ignore' });
              console.log('[TTS] Using festival');
              return 'festival';
            } catch {
              console.error('[TTS] No TTS engine found (espeak-ng, espeak, or festival)');
              return null;
            }
          }
        }
      };

      const engine = detectEngine();
      
      if (!engine) {
        return { success: false, error: 'No TTS engine available' };
      }

      let ttsProcess;
      if (engine === 'espeak-ng' || engine === 'espeak') {
        ttsProcess = spawn(engine, ['-v', 'es', text], {
          stdio: 'ignore',
        });
      } else if (engine === 'festival') {
        ttsProcess = spawn('festival', ['--tts'], {
          stdio: ['pipe', 'ignore', 'ignore'],
        });
        ttsProcess.stdin.write(text);
        ttsProcess.stdin.end();
      }

      return new Promise((resolve) => {
        ttsProcess.on('close', (code) => {
          if (code === 0) {
            console.log('[TTS] Speech completed successfully');
            resolve({ success: true });
          } else {
            console.error(`[TTS] ${engine} exited with code ${code}`);
            resolve({ success: false, error: `Exit code ${code}` });
          }
        });

        ttsProcess.on('error', (err) => {
          console.error(`[TTS] ${engine} error:`, err);
          resolve({ success: false, error: err.message });
        });
      });
    }
  } catch (error) {
    console.error('[TTS] Exception:', error);
    return { success: false, error: error.message };
  }
});

// Stop TTS handler
ipcMain.handle('speak-stop', async () => {
  console.log('[TTS] Stop requested');
  
  try {
    if (isWindows()) {
      // Kill any running PowerShell TTS processes
      execSync('taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq *Speech*" 2>nul', { stdio: 'ignore' });
    } else {
      // Kill espeak/festival processes
      try {
        execSync('pkill -9 espeak-ng', { stdio: 'ignore' });
      } catch {}
      try {
        execSync('pkill -9 espeak', { stdio: 'ignore' });
      } catch {}
      try {
        execSync('pkill -9 festival', { stdio: 'ignore' });
      } catch {}
    }
    
    console.log('[TTS] Stopped successfully');
    return { success: true };
  } catch (error) {
    console.error('[TTS] Stop error:', error);
    return { success: false, error: error.message };
  }
});