import { existsSync } from 'fs';
import { dirname } from 'path';
import { openFolder as openFolderAdapter, isWindows } from './utils/OsAdapter.js';

export interface OpenFolderResult {
  success: boolean;
  message: string;
  path?: string;
  folderPath?: string;
  error?: string;
}

/**
 * Open the parent folder of a file in the file manager
 * Windows: Highlights the file using explorer /select
 * Linux/macOS: Opens the parent folder
 * 
 * @param filePath - Path to the file
 * @returns OpenFolderResult with success status
 */
export async function openFolder(filePath: string): Promise<OpenFolderResult> {
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

    // Get parent directory
    const folderPath = dirname(filePath);

    // On Windows, use /select to highlight the file
    // On Linux/macOS, just open the folder
    if (isWindows()) {
      const result = await openFolderAdapter(filePath);
      return {
        success: result.success,
        message: result.message,
        path: filePath,
        folderPath,
        error: result.error
      };
    } else {
      const result = await openFolderAdapter(folderPath);
      return {
        success: result.success,
        message: `Opened folder: ${folderPath}`,
        path: filePath,
        folderPath,
        error: result.error
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to open folder for: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to open folder for: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}
