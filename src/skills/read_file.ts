/**
 * Error types for file reading operations
 */
export type FileErrorType = 'NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN';

/**
 * Result interface for file reading operations
 */
export interface FileReadResult {
  success: boolean;
  content?: string;
  error?: string;
  errorType?: FileErrorType;
}

import { readFile as fsReadFile } from 'fs/promises';

/**
 * Reads a text file from the local file system with UTF-8 encoding
 * @param filePath - Path to the file to read
 * @returns FileReadResult with file content on success or error details on failure
 */
export async function readFile(filePath: string): Promise<FileReadResult> {
  try {
    // Read file with explicit UTF-8 encoding
    const content = await fsReadFile(filePath, 'utf-8');
    
    return {
      success: true,
      content
    };
  } catch (error: any) {
    // Classify error by error code
    let errorType: FileErrorType = 'UNKNOWN';
    let errorMessage = `Failed to read file: ${filePath}`;
    
    if (error.code === 'ENOENT') {
      errorType = 'NOT_FOUND';
      errorMessage = `File not found: ${filePath}`;
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorType = 'PERMISSION_DENIED';
      errorMessage = `Permission denied reading file: ${filePath}`;
    } else if (error.message) {
      errorMessage = `${errorMessage} - ${error.message}`;
    }
    
    return {
      success: false,
      error: errorMessage,
      errorType
    };
  }
}
