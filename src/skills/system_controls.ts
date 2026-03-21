import { exec } from 'child_process';
import { isWindows, runCommand } from './utils/OsAdapter.js';

export interface SystemControlResult {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  error?: string;
}

// Store pending confirmations with timestamps
const pendingConfirmations = new Map<string, { action: string; timestamp: number }>();

// Confirmation timeout: 30 seconds
const CONFIRMATION_TIMEOUT = 30000;

/**
 * Clean up expired confirmations
 */
function cleanupExpiredConfirmations(): void {
  const now = Date.now();
  for (const [token, data] of pendingConfirmations.entries()) {
    if (now - data.timestamp > CONFIRMATION_TIMEOUT) {
      pendingConfirmations.delete(token);
      console.log(`[System Controls] Expired confirmation: ${token}`);
    }
  }
}

/**
 * Generate a confirmation token
 */
function generateConfirmationToken(action: string): string {
  cleanupExpiredConfirmations();
  const token = `${action}_${Date.now()}`;
  pendingConfirmations.set(token, { action, timestamp: Date.now() });
  console.log(`[System Controls] Generated confirmation token: ${token}`);
  return token;
}

/**
 * Verify a confirmation token
 */
function verifyConfirmationToken(action: string): boolean {
  cleanupExpiredConfirmations();
  
  // Find matching confirmation
  for (const [token, data] of pendingConfirmations.entries()) {
    if (data.action === action) {
      pendingConfirmations.delete(token);
      console.log(`[System Controls] Confirmed action: ${action}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Lock the PC
 */
export async function lockPC(): Promise<SystemControlResult> {
  try {
    console.log('[System Controls] Locking PC');

    if (isWindows()) {
      // Use rundll32 to lock the workstation
      const command = 'rundll32.exe user32.dll,LockWorkStation';

      await new Promise<void>((resolve, reject) => {
        exec(command, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });

      return {
        success: true,
        message: 'Bloqueé la PC'
      };
    } else {
      // Try Linux alternatives in sequence
      const alternatives = [
        'loginctl lock-session',
        'xdg-screensaver lock',
        'gnome-screensaver-command -l',
        'xlock'
      ];

      for (const alt of alternatives) {
        try {
          await runCommand(alt);
          return {
            success: true,
            message: 'Bloqueé la PC'
          };
        } catch {
          continue;
        }
      }

      return {
        success: false,
        message: 'No pude bloquear la pantalla',
        error: 'No lock command available'
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: 'No pude bloquear la pantalla',
        error: error.message
      };
    }

    return {
      success: false,
      message: 'No pude bloquear la pantalla',
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Request shutdown confirmation
 */
export function requestShutdown(): SystemControlResult {
  const token = generateConfirmationToken('shutdown');
  
  return {
    success: true,
    message: '⚠️ Are you sure you want to shut down the PC? Type "confirm shutdown" to proceed.',
    requiresConfirmation: true,
    confirmationToken: token
  };
}

/**
 * Shutdown the PC (requires prior confirmation)
 */
export async function shutdownPC(): Promise<SystemControlResult> {
  try {
    // Verify confirmation
    if (!verifyConfirmationToken('shutdown')) {
      return {
        success: false,
        message: 'Shutdown requires confirmation. Type "shutdown pc" first, then "confirm shutdown".',
        error: 'No valid confirmation found'
      };
    }

    console.log('[System Controls] Shutting down PC');

    // Use shutdown command with 10 second delay
    const command = 'shutdown /s /t 10';

    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return {
      success: true,
      message: 'PC will shut down in 10 seconds. Type "shutdown /a" in Command Prompt to cancel.'
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: 'Failed to shut down PC',
        error: error.message
      };
    }

    return {
      success: false,
      message: 'Failed to shut down PC',
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Request restart confirmation
 */
export function requestRestart(): SystemControlResult {
  const token = generateConfirmationToken('restart');
  
  return {
    success: true,
    message: '⚠️ Are you sure you want to restart the PC? Type "confirm restart" to proceed.',
    requiresConfirmation: true,
    confirmationToken: token
  };
}

/**
 * Restart the PC (requires prior confirmation)
 */
export async function restartPC(): Promise<SystemControlResult> {
  try {
    // Verify confirmation
    if (!verifyConfirmationToken('restart')) {
      return {
        success: false,
        message: 'Restart requires confirmation. Type "restart pc" first, then "confirm restart".',
        error: 'No valid confirmation found'
      };
    }

    console.log('[System Controls] Restarting PC');

    // Use shutdown command with restart flag and 10 second delay
    const command = 'shutdown /r /t 10';

    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return {
      success: true,
      message: 'PC will restart in 10 seconds. Type "shutdown /a" in Command Prompt to cancel.'
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: 'Failed to restart PC',
        error: error.message
      };
    }

    return {
      success: false,
      message: 'Failed to restart PC',
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Request sleep confirmation
 */
export function requestSleep(): SystemControlResult {
  const token = generateConfirmationToken('sleep');
  
  return {
    success: true,
    message: '⚠️ Are you sure you want to put the PC to sleep? Type "confirm sleep" to proceed.',
    requiresConfirmation: true,
    confirmationToken: token
  };
}

/**
 * Put the PC to sleep (requires prior confirmation)
 */
export async function sleepPC(): Promise<SystemControlResult> {
  try {
    // Verify confirmation
    if (!verifyConfirmationToken('sleep')) {
      return {
        success: false,
        message: 'Sleep requires confirmation. Type "sleep pc" first, then "confirm sleep".',
        error: 'No valid confirmation found'
      };
    }

    console.log('[System Controls] Putting PC to sleep');

    // Use rundll32 to suspend (sleep) the system
    const command = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';

    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return {
      success: true,
      message: 'PC is going to sleep'
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: 'Failed to put PC to sleep',
        error: error.message
      };
    }

    return {
      success: false,
      message: 'Failed to put PC to sleep',
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Confirm a system action
 */
export async function confirmSystemAction(action: 'shutdown' | 'restart' | 'sleep'): Promise<SystemControlResult> {
  console.log(`[System Controls] Confirming action: ${action}`);

  switch (action) {
    case 'shutdown':
      return await shutdownPC();
    case 'restart':
      return await restartPC();
    case 'sleep':
      return await sleepPC();
    default:
      return {
        success: false,
        message: `Unknown action: ${action}`,
        error: 'Invalid action'
      };
  }
}
