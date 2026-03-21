const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");

let mainWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;
let ollamaProcess = null;
let isQuitting = false;

const iconPath = path.join(__dirname, "icon.ico");

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

function createWindow() {
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

  mainWindow.loadURL("http://localhost:5173");

  mainWindow.once("ready-to-show", () => {
    // Start minimized to tray - don't show on first launch
    // User can open via tray click or Ctrl+Space
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

app.whenReady().then(() => {
  try {
    // Start Ollama first
    startOllama();
    
    startProcesses();
    createWindow();
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