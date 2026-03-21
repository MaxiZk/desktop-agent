import { existsSync } from 'fs';
import { openFile as openFileAdapter } from './utils/OsAdapter.js';

export interface OpenFileResult {
  success: boolean;
  message: string;
  path?: string;
  error?: string;
}

/**
 * Open a file with the system default program
 * Cross-platform: Windows (start), Linux (xdg-open), macOS (open)
 * 
 * @param filePath - Path to the file to open
 * @returns OpenFileResult with success status
 */
export async function openFile(filePath: string): Promise<OpenFileResult> {
  try {
    // Validate input
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        message: 'File path is required',
        error: 'File path is required'
      };
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return {
        success: false,
        message: `File not found: ${filePath}`,
        path: filePath,
        error: 'File not found'
      };
    }

    // Open file using OsAdapter
    const result = await openFileAdapter(filePath);

    return {
      success: result.success,
      message: result.message,
      path: filePath,
      error: result.error
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to open file: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to open file: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}
