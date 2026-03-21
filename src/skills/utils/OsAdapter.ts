/**
 * OsAdapter.ts — Cross-platform OS utilities
 * 
 * Provides platform detection and cross-platform implementations for:
 * - Running shell commands
 * - Opening apps, files, and folders
 * - Process management
 */

import { exec } from 'child_process';

export interface CommandResult {
  success: boolean;
  message: string;
  error?: string;
}

// ── Platform Detection ──────────────────────────────────────────────────────

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

// ── Command Execution ───────────────────────────────────────────────────────

/**
 * Execute a shell command with timeout
 */
export function runCommand(command: string, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(
      command,
      { windowsHide: isWindows() },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      }
    );

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Command timeout'));
    }, timeoutMs);

    child.on('exit', () => {
      clearTimeout(timer);
    });
  });
}

// ── App Launching ───────────────────────────────────────────────────────────

/**
 * Open an application by name or path
 */
export async function openApp(appNameOrPath: string): Promise<CommandResult> {
  try {
    let command: string;

    if (isWindows()) {
      command = `start "" "${appNameOrPath}"`;
    } else if (isLinux()) {
      // Use nohup to detach process
      command = `nohup ${appNameOrPath} > /dev/null 2>&1 &`;
    } else if (isMac()) {
      command = `open -a "${appNameOrPath}"`;
    } else {
      return {
        success: false,
        message: `Unsupported platform: ${process.platform}`,
      };
    }

    await runCommand(command);

    return {
      success: true,
      message: `${appNameOrPath} opened successfully`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to open ${appNameOrPath}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ── File Operations ─────────────────────────────────────────────────────────

/**
 * Open a file with the default application
 */
export async function openFile(filePath: string): Promise<CommandResult> {
  try {
    let command: string;

    if (isWindows()) {
      command = `start "" "${filePath}"`;
    } else if (isLinux()) {
      command = `xdg-open "${filePath}"`;
    } else if (isMac()) {
      command = `open "${filePath}"`;
    } else {
      return {
        success: false,
        message: `Unsupported platform: ${process.platform}`,
      };
    }

    await runCommand(command);

    return {
      success: true,
      message: `File opened: ${filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to open file: ${filePath}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Open a folder in the file manager
 */
export async function openFolder(folderPath: string): Promise<CommandResult> {
  try {
    let command: string;

    if (isWindows()) {
      command = `explorer.exe /select,"${folderPath}"`;
    } else if (isLinux()) {
      command = `xdg-open "${folderPath}"`;
    } else if (isMac()) {
      command = `open "${folderPath}"`;
    } else {
      return {
        success: false,
        message: `Unsupported platform: ${process.platform}`,
      };
    }

    await runCommand(command);

    return {
      success: true,
      message: `Folder opened: ${folderPath}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to open folder: ${folderPath}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ── Process Management ──────────────────────────────────────────────────────

/**
 * List running processes
 */
export async function listProcesses(): Promise<string[]> {
  try {
    let command: string;

    if (isWindows()) {
      command = 'tasklist';
    } else if (isLinux() || isMac()) {
      command = 'ps aux';
    } else {
      return [];
    }

    const output = await runCommand(command, 5000);
    return output.split('\n').filter(line => line.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Check if a process is running
 */
export function isProcessRunning(processName: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (isWindows()) {
      exec(
        `tasklist /FI "IMAGENAME eq ${processName}"`,
        { windowsHide: true },
        (error, stdout) => {
          if (error) {
            resolve(false);
            return;
          }
          resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
        }
      );
    } else {
      // On Linux/macOS, remove .exe extension and use pgrep -f
      const linuxName = processName.replace(/\.exe$/i, '').toLowerCase();
      exec(`pgrep -f "${linuxName}"`, (error, stdout) => {
        resolve(!error && stdout.trim().length > 0);
      });
    }
  });
}
