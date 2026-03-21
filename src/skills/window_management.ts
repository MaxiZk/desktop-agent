import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface WindowManagementResult {
  success: boolean;
  message: string;
  appName?: string;
  error?: string;
}

export interface RunningApp {
  name: string;
  pid: number;
  memoryUsage: string;
}

export interface RunningAppsResult {
  success: boolean;
  message: string;
  apps?: RunningApp[];
  count?: number;
  error?: string;
}

interface AppConfig {
  type: 'path' | 'command' | 'url';
  value: string;
  aliases: string[];
}

interface AppsConfig {
  apps: Record<string, AppConfig>;
}

// Cache for loaded config
let cachedConfig: AppsConfig | null = null;

/**
 * Load app configuration from config/apps.json
 */
function loadAppConfig(): AppsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = resolve(process.cwd(), 'config/apps.json');
    const configData = readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(configData);
    return cachedConfig!;
  } catch (error) {
    console.error('[Window Management] Failed to load config/apps.json:', error);
    return { apps: {} };
  }
}

/**
 * Find app configuration by name or alias
 */
function findAppConfig(appName: string): { key: string; config: AppConfig } | null {
  const config = loadAppConfig();
  const normalizedName = appName.toLowerCase().trim();

  // First, try exact match with app key
  for (const [key, appConfig] of Object.entries(config.apps)) {
    if (key.toLowerCase() === normalizedName) {
      return { key, config: appConfig };
    }
  }

  // Then, try matching aliases
  for (const [key, appConfig] of Object.entries(config.apps)) {
    if (appConfig.aliases.some(alias => alias.toLowerCase() === normalizedName)) {
      return { key, config: appConfig };
    }
  }

  return null;
}

/**
 * Get process name from app configuration
 */
function getProcessName(appName: string): string | null {
  const appMatch = findAppConfig(appName);
  
  if (!appMatch) {
    return null;
  }

  const { key } = appMatch;

  // Map app names to their process names
  const processMap: Record<string, string> = {
    'chrome': 'chrome.exe',
    'firefox': 'firefox.exe',
    'edge': 'msedge.exe',
    'vscode': 'Code.exe',
    'word': 'WINWORD.EXE',
    'excel': 'EXCEL.EXE',
    'powerpoint': 'POWERPNT.EXE',
    'outlook': 'OUTLOOK.EXE',
    'discord': 'Discord.exe',
    'slack': 'slack.exe',
    'teams': 'Teams.exe',
    'zoom': 'Zoom.exe',
    'notepad': 'notepad.exe',
    'calculator': 'CalculatorApp.exe',
    'paint': 'mspaint.exe',
    'explorer': 'explorer.exe',
    'cmd': 'cmd.exe',
    'powershell': 'powershell.exe',
    'spotify': 'Spotify.exe',
    'vlc': 'vlc.exe',
    'whatsapp': 'WhatsApp.exe'
  };

  return processMap[key] || null;
}

/**
 * Close an application by name
 */
export async function closeAppByName(appName: string): Promise<WindowManagementResult> {
  try {
    if (!appName || appName.trim() === '') {
      return {
        success: false,
        message: 'App name is required',
        error: 'App name is required'
      };
    }

    const processName = getProcessName(appName);

    if (!processName) {
      const config = loadAppConfig();
      const availableApps = Object.keys(config.apps).slice(0, 20).join(', ');
      
      return {
        success: false,
        message: `Unknown app: "${appName}". Available apps: ${availableApps}`,
        appName,
        error: 'App not found in configuration'
      };
    }

    console.log(`[Window Management] Closing app: ${appName}`);
    console.log(`[Window Management] Process name: ${processName}`);

    // Use taskkill to close the application
    const command = `taskkill /IM "${processName}" /F`;

    await new Promise<void>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Check if error is because process not found
          if (stderr.includes('not found') || stdout.includes('not found')) {
            reject(new Error(`${appName} is not currently running`));
            return;
          }
          reject(error);
          return;
        }
        resolve();
      });
    });

    return {
      success: true,
      message: `${appName} closed successfully`,
      appName
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
        appName,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to close ${appName}`,
      appName,
      error: 'Unknown error occurred'
    };
  }
}

/**
 * List all running applications
 */
export async function listRunningApps(): Promise<RunningAppsResult> {
  try {
    console.log('[Window Management] Listing running applications');

    // Use tasklist to get running processes
    const command = 'tasklist /FO CSV /NH';

    const output = await new Promise<string>((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });

    // Parse CSV output
    const lines = output.trim().split('\n');
    const apps: RunningApp[] = [];

    for (const line of lines) {
      // Parse CSV line: "name","pid","session","session#","memory"
      const match = line.match(/"([^"]+)","(\d+)","[^"]+","[^"]+","([^"]+)"/);
      if (match) {
        const [, name, pid, memory] = match;
        apps.push({
          name,
          pid: parseInt(pid, 10),
          memoryUsage: memory
        });
      }
    }

    console.log(`[Window Management] Found ${apps.length} running processes`);

    return {
      success: true,
      message: `Found ${apps.length} running applications`,
      apps,
      count: apps.length
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: 'Failed to list running applications',
        error: error.message
      };
    }

    return {
      success: false,
      message: 'Failed to list running applications',
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Focus an application by name (bring to foreground)
 */
export async function focusAppByName(appName: string): Promise<WindowManagementResult> {
  try {
    if (!appName || appName.trim() === '') {
      return {
        success: false,
        message: 'App name is required',
        error: 'App name is required'
      };
    }

    const processName = getProcessName(appName);

    if (!processName) {
      const config = loadAppConfig();
      const availableApps = Object.keys(config.apps).slice(0, 20).join(', ');
      
      return {
        success: false,
        message: `Unknown app: "${appName}". Available apps: ${availableApps}`,
        appName,
        error: 'App not found in configuration'
      };
    }

    console.log(`[Window Management] Focusing app: ${appName}`);
    console.log(`[Window Management] Process name: ${processName}`);

    // Use PowerShell to bring window to foreground
    const psScript = `
      $proc = Get-Process -Name "${processName.replace('.exe', '')}" -ErrorAction SilentlyContinue
      if ($proc) {
        $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
        $type = Add-Type -MemberDefinition $sig -Name WindowAPI -PassThru
        $type::SetForegroundWindow($proc.MainWindowHandle)
        Write-Output "Success"
      } else {
        Write-Output "NotRunning"
      }
    `;

    const command = `powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

    const output = await new Promise<string>((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      });
    });

    if (output.includes('NotRunning')) {
      return {
        success: false,
        message: `${appName} is not currently running`,
        appName,
        error: 'Application not running'
      };
    }

    return {
      success: true,
      message: `${appName} focused successfully`,
      appName
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to focus ${appName}`,
        appName,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to focus ${appName}`,
      appName,
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Minimize an application by name
 */
export async function minimizeAppByName(appName: string): Promise<WindowManagementResult> {
  try {
    if (!appName || appName.trim() === '') {
      return {
        success: false,
        message: 'App name is required',
        error: 'App name is required'
      };
    }

    const processName = getProcessName(appName);

    if (!processName) {
      const config = loadAppConfig();
      const availableApps = Object.keys(config.apps).slice(0, 20).join(', ');
      
      return {
        success: false,
        message: `Unknown app: "${appName}". Available apps: ${availableApps}`,
        appName,
        error: 'App not found in configuration'
      };
    }

    console.log(`[Window Management] Minimizing app: ${appName}`);
    console.log(`[Window Management] Process name: ${processName}`);

    // Use PowerShell to minimize window
    const psScript = `
      $proc = Get-Process -Name "${processName.replace('.exe', '')}" -ErrorAction SilentlyContinue
      if ($proc) {
        $sig = @'
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
        $type = Add-Type -MemberDefinition $sig -Name WindowAPI -Namespace Win32 -PassThru
        $type::ShowWindow($proc.MainWindowHandle, 6)
        Write-Output "Success"
      } else {
        Write-Output "NotRunning"
      }
    `;

    const command = `powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

    const output = await new Promise<string>((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      });
    });

    if (output.includes('NotRunning')) {
      return {
        success: false,
        message: `${appName} is not currently running`,
        appName,
        error: 'Application not running'
      };
    }

    return {
      success: true,
      message: `${appName} minimized successfully`,
      appName
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to minimize ${appName}`,
        appName,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to minimize ${appName}`,
      appName,
      error: 'Unknown error occurred'
    };
  }
}
