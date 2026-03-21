import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

export interface CommandHistoryEntry {
  timestamp: string;
  command: string;
  intent: string;
  method: string;
  confidence: number;
  executionTime: number;
  result: string;
}

export interface CommandHistoryResult {
  success: boolean;
  entries?: CommandHistoryEntry[];
  count?: number;
  error?: string;
}

const HISTORY_FILE = join(process.cwd(), 'logs', 'command_history.json');

/**
 * Save a command to history
 */
export async function saveCommandToHistory(entry: CommandHistoryEntry): Promise<void> {
  try {
    // Ensure logs directory exists
    const logsDir = dirname(HISTORY_FILE);
    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
    }

    // Read existing history
    let history: CommandHistoryEntry[] = [];
    if (existsSync(HISTORY_FILE)) {
      const content = await readFile(HISTORY_FILE, 'utf-8');
      history = JSON.parse(content);
    }

    // Add new entry
    history.push(entry);

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    // Save history
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Command History] Failed to save:', error);
  }
}

/**
 * Get command history (last N entries)
 */
export async function getCommandHistory(limit: number = 10): Promise<CommandHistoryResult> {
  try {
    if (!existsSync(HISTORY_FILE)) {
      return {
        success: true,
        entries: [],
        count: 0
      };
    }

    const content = await readFile(HISTORY_FILE, 'utf-8');
    const history: CommandHistoryEntry[] = JSON.parse(content);

    // Get last N entries
    const entries = history.slice(-limit).reverse();

    return {
      success: true,
      entries,
      count: entries.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
