import { readFile as fsReadFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface FileReadResult {
  success: boolean;
  content?: string;
  path?: string;
  size?: number;
  error?: string;
}

/**
 * Read a local text file by path
 * 
 * @param filePath - Absolute or relative path to the file
 * @returns FileReadResult with content or error
 */
export async function readFileByPath(filePath: string): Promise<FileReadResult> {
  try {
    // Validate input
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        error: 'File path is required'
      };
    }

    // Resolve to absolute path
    const absolutePath = resolve(filePath);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      return {
        success: false,
        error: `File not found: ${absolutePath}`,
        path: absolutePath
      };
    }

    // Read file with UTF-8 encoding
    const content = await fsReadFile(absolutePath, 'utf-8');

    return {
      success: true,
      content,
      path: absolutePath,
      size: content.length
    };
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Permission denied
      if ('code' in error && error.code === 'EACCES') {
        return {
          success: false,
          error: `Permission denied: ${filePath}`,
          path: filePath
        };
      }

      // File is a directory
      if ('code' in error && error.code === 'EISDIR') {
        return {
          success: false,
          error: `Path is a directory, not a file: ${filePath}`,
          path: filePath
        };
      }

      // Generic error
      return {
        success: false,
        error: error.message,
        path: filePath
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred',
      path: filePath
    };
  }
}
