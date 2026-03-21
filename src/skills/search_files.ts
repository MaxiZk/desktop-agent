import { readdir } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';

export interface FileSearchResult {
  success: boolean;
  results?: string[];
  count?: number;
  query?: string;
  directory?: string;
  error?: string;
}

/**
 * Search for files by name in a directory (recursive)
 * 
 * @param query - Search query (filename or pattern)
 * @param directory - Directory to search in (defaults to Desktop)
 * @param maxResults - Maximum number of results to return (default: 20)
 * @returns FileSearchResult with matching file paths
 */
export async function searchFiles(
  query: string,
  directory?: string,
  maxResults: number = 20
): Promise<FileSearchResult> {
  try {
    // Validate query
    if (!query || query.trim() === '') {
      return {
        success: false,
        error: 'Search query is required'
      };
    }

    // Default to Desktop if no directory specified
    const searchDir = directory || join(homedir(), 'Desktop');
    
    // Normalize query for case-insensitive search
    const normalizedQuery = query.toLowerCase().trim();

    // Search for files
    const results: string[] = [];
    await searchRecursive(searchDir, normalizedQuery, results, maxResults);

    return {
      success: true,
      results,
      count: results.length,
      query,
      directory: searchDir
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
        query,
        directory
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred',
      query,
      directory
    };
  }
}

/**
 * Recursively search for files matching the query
 */
async function searchRecursive(
  dir: string,
  query: string,
  results: string[],
  maxResults: number
): Promise<void> {
  // Stop if we've reached max results
  if (results.length >= maxResults) {
    return;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Stop if we've reached max results
      if (results.length >= maxResults) {
        break;
      }

      const fullPath = join(dir, entry.name);

      try {
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          await searchRecursive(fullPath, query, results, maxResults);
        } else if (entry.isFile()) {
          // Check if filename matches query
          const filename = basename(fullPath).toLowerCase();
          if (filename.includes(query)) {
            results.push(fullPath);
          }
        }
      } catch (err) {
        // Skip files/directories we can't access
        continue;
      }
    }
  } catch (error) {
    // Skip directories we can't read
    return;
  }
}
