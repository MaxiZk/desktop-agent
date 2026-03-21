/**
 * Memory Store Module
 * 
 * Provides TypeScript interfaces and types for JSON-based persistent storage
 * of application memory data.
 */

/**
 * Error type classification for memory operations
 */
export type MemoryErrorType = 'NOT_FOUND' | 'PARSE_ERROR' | 'UNKNOWN';

/**
 * Flexible memory data structure supporting any JSON-serializable data
 * including nested objects and arrays
 */
export interface MemoryData {
  [key: string]: any;
}

/**
 * Result type for memory save operations
 */
export interface MemorySaveResult {
  success: boolean;
  error?: string;
}

/**
 * Result type for memory load operations
 */
export interface MemoryLoadResult {
  success: boolean;
  data?: MemoryData;
  error?: string;
  errorType?: MemoryErrorType;
}

import { writeFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Default memory file location in project root
 */
const DEFAULT_MEMORY_FILE = './memory.json';

/**
 * Saves memory data to a JSON file
 * 
 * @param data - The memory data to save (any JSON-serializable object)
 * @param filePath - Optional custom file path (defaults to ./memory.json)
 * @returns MemorySaveResult with success flag and optional error message
 * 
 * @example
 * const result = await saveMemory({ user: 'John', settings: { theme: 'dark' } });
 * if (result.success) {
 *   console.log('Memory saved successfully');
 * }
 */
export async function saveMemory(
  data: MemoryData,
  filePath: string = DEFAULT_MEMORY_FILE
): Promise<MemorySaveResult> {
  try {
    // Serialize data to JSON with 2-space indentation for readability
    const jsonContent = JSON.stringify(data, null, 2);
    
    // Resolve the file path to absolute path
    const absolutePath = resolve(filePath);
    
    // Write JSON content to file
    await writeFile(absolutePath, jsonContent, 'utf-8');
    
    return {
      success: true
    };
  } catch (error) {
    // Handle any file write errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      error: `Failed to save memory: ${errorMessage}`
    };
  }
}

/**
 * Loads memory data from a JSON file
 * 
 * @param filePath - Optional custom file path (defaults to ./memory.json)
 * @returns MemoryLoadResult with success flag, data, and optional error information
 * 
 * @example
 * const result = await loadMemory();
 * if (result.success) {
 *   console.log('Memory loaded:', result.data);
 * }
 */
export async function loadMemory(
  filePath: string = DEFAULT_MEMORY_FILE
): Promise<MemoryLoadResult> {
  try {
    // Import readFile here to avoid circular dependencies
    const { readFile } = await import('fs/promises');
    
    // Resolve the file path to absolute path
    const absolutePath = resolve(filePath);
    
    // Read JSON content from file
    const jsonContent = await readFile(absolutePath, 'utf-8');
    
    // Parse JSON content
    const data = JSON.parse(jsonContent);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    // Handle file not found - return empty object (not an error)
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {
        success: true,
        data: {}
      };
    }
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Failed to parse memory file: ${error.message}`,
        errorType: 'PARSE_ERROR'
      };
    }
    
    // Handle other unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      error: `Failed to load memory: ${errorMessage}`,
      errorType: 'UNKNOWN'
    };
  }
}
